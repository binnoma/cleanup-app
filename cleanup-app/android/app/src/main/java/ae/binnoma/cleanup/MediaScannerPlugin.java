package ae.binnoma.cleanup;

import android.Manifest;
import android.app.Activity;
import android.app.RecoverableSecurityException;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "MediaScanner",
    permissions = {
        @Permission(
            alias = "mediaImages",
            strings = { "android.permission.READ_MEDIA_IMAGES" }
        ),
        @Permission(
            alias = "mediaVideo",
            strings = { "android.permission.READ_MEDIA_VIDEO" }
        ),
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "writeStorage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class MediaScannerPlugin extends Plugin {

    private static final String TAG = "MediaScanner";
    private static final int DELETE_REQUEST_CODE = 5001;
    private static final long DELETE_TIMEOUT_MS = 20000; // 20 seconds timeout

    // Static instance for MainActivity to forward results
    private static MediaScannerPlugin instance;

    // Saved call for async delete operations
    private PluginCall savedDeleteCall = null;
    private List<Uri> savedDeleteUris = null;
    private int preDeletedCount = 0;
    private int preFailedCount = 0;
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable = null;

    @Override
    public void load() {
        instance = this;
        super.load();
    }

    public static MediaScannerPlugin getInstance() {
        return instance;
    }

    // ═══════════════════════════════════════════════════════════
    // PERMISSIONS
    // ═══════════════════════════════════════════════════════════

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        boolean granted = hasStoragePermission();
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (hasStoragePermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAliases(new String[]{"mediaImages", "mediaVideo"}, call, "permissionCallback");
        } else {
            requestPermissionForAliases(new String[]{"storage", "writeStorage"}, call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean granted = hasStoragePermission();
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    private boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            boolean imagesGranted = getPermissionState("mediaImages") == PermissionState.GRANTED;
            boolean videoGranted = getPermissionState("mediaVideo") == PermissionState.GRANTED;
            return imagesGranted || videoGranted;
        } else {
            boolean readGranted = getPermissionState("storage") == PermissionState.GRANTED;
            return readGranted;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SCAN PHOTOS
    // ═══════════════════════════════════════════════════════════

    @PluginMethod
    public void scanPhotos(PluginCall call) {
        try {
            if (!hasStoragePermission()) {
                call.reject("Storage permission not granted");
                return;
            }

            JSArray photos = new JSArray();
            ContentResolver resolver = getContext().getContentResolver();

            scanImages(resolver, photos);
            scanVideos(resolver, photos);

            JSObject result = new JSObject();
            result.put("photos", photos);
            result.put("totalCount", photos.length());
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Failed to scan photos", e);
            call.reject("Failed to scan photos: " + e.getMessage());
        }
    }

    private void scanImages(ContentResolver resolver, JSArray photos) {
        Uri collection = MediaStore.Images.Media.getContentUri("external");

        String[] projection = {
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.SIZE,
            MediaStore.Images.Media.DATE_MODIFIED,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
            MediaStore.Images.Media.DATA,
            MediaStore.Images.Media.DATE_TAKEN,
            MediaStore.Images.Media.MIME_TYPE
        };

        String sortOrder = MediaStore.Images.Media.DATE_MODIFIED + " DESC";

        try (Cursor cursor = resolver.query(collection, projection, null, null, sortOrder)) {
            if (cursor == null) return;

            int idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
            int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
            int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
            int dateModCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_MODIFIED);
            int widthCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH);
            int heightCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT);
            int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
            int dateTakenCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN);
            int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);

            while (cursor.moveToNext()) {
                try {
                    long id = cursor.getLong(idCol);
                    String name = cursor.getString(nameCol);
                    long size = cursor.getLong(sizeCol);
                    long dateModified = cursor.getLong(dateModCol);
                    int width = cursor.getInt(widthCol);
                    int height = cursor.getInt(heightCol);
                    String filePath = cursor.getString(dataCol);
                    long dateTaken = cursor.getLong(dateTakenCol);
                    String mimeType = cursor.getString(mimeCol);
                    long dateMs = dateTaken > 0 ? dateTaken : (dateModified * 1000);

                    Uri contentUri = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);

                    JSObject photo = new JSObject();
                    photo.put("id", "img-" + id);
                    photo.put("name", name != null ? name : "Image");
                    photo.put("size", size);
                    photo.put("date", dateMs);
                    photo.put("width", width > 0 ? width : 0);
                    photo.put("height", height > 0 ? height : 0);
                    photo.put("filePath", filePath != null ? filePath : "");
                    photo.put("contentUri", contentUri.toString());
                    photo.put("type", "image");
                    photo.put("mimeType", mimeType != null ? mimeType : "image/jpeg");
                    photos.put(photo);
                } catch (Exception e) {
                    Log.w(TAG, "Error reading image row", e);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying images", e);
        }
    }

    private void scanVideos(ContentResolver resolver, JSArray photos) {
        Uri collection = MediaStore.Video.Media.getContentUri("external");

        String[] projection = {
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.SIZE,
            MediaStore.Video.Media.DATE_MODIFIED,
            MediaStore.Video.Media.WIDTH,
            MediaStore.Video.Media.HEIGHT,
            MediaStore.Video.Media.DATA,
            MediaStore.Video.Media.DATE_TAKEN,
            MediaStore.Video.Media.MIME_TYPE,
            MediaStore.Video.Media.DURATION
        };

        String sortOrder = MediaStore.Video.Media.DATE_MODIFIED + " DESC";

        try (Cursor cursor = resolver.query(collection, projection, null, null, sortOrder)) {
            if (cursor == null) return;

            int idCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
            int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME);
            int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE);
            int dateModCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_MODIFIED);
            int widthCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH);
            int heightCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT);
            int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
            int dateTakenCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_TAKEN);
            int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE);
            int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION);

            while (cursor.moveToNext()) {
                try {
                    long id = cursor.getLong(idCol);
                    String name = cursor.getString(nameCol);
                    long size = cursor.getLong(sizeCol);
                    long dateModified = cursor.getLong(dateModCol);
                    int width = cursor.getInt(widthCol);
                    int height = cursor.getInt(heightCol);
                    String filePath = cursor.getString(dataCol);
                    long dateTaken = cursor.getLong(dateTakenCol);
                    String mimeType = cursor.getString(mimeCol);
                    long duration = cursor.getLong(durationCol);
                    long dateMs = dateTaken > 0 ? dateTaken : (dateModified * 1000);

                    Uri contentUri = ContentUris.withAppendedId(
                        MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id);

                    JSObject video = new JSObject();
                    video.put("id", "vid-" + id);
                    video.put("name", name != null ? name : "Video");
                    video.put("size", size);
                    video.put("date", dateMs);
                    video.put("width", width > 0 ? width : 0);
                    video.put("height", height > 0 ? height : 0);
                    video.put("filePath", filePath != null ? filePath : "");
                    video.put("contentUri", contentUri.toString());
                    video.put("type", "video");
                    video.put("mimeType", mimeType != null ? mimeType : "video/mp4");
                    video.put("duration", duration);
                    photos.put(video);
                } catch (Exception e) {
                    Log.w(TAG, "Error reading video row", e);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying videos", e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // REAL FILE DELETION
    // ═══════════════════════════════════════════════════════════

    /**
     * Delete photos from device storage.
     *
     * Strategy:
     * - API 30+ (Android 11+): Try ContentResolver.delete() first for each URI,
     *   then use MediaStore.createDeleteRequest() for URIs that need user consent.
     * - API 29 (Android 10): Try ContentResolver.delete() + file system deletion.
     * - API < 29: Direct ContentResolver.delete() + file system deletion.
     */
    @PluginMethod
    public void deletePhotos(PluginCall call) {
        JSArray contentUrisArray = call.getArray("contentUris");

        try {
            List<Object> uriStrings = contentUrisArray.toList();
            if (uriStrings.isEmpty()) {
                JSObject result = new JSObject();
                result.put("deleted", 0);
                result.put("failed", 0);
                call.resolve(result);
                return;
            }

            List<Uri> urisToDelete = new ArrayList<>();
            for (Object obj : uriStrings) {
                String uriStr = (String) obj;
                urisToDelete.add(Uri.parse(uriStr));
            }

            Log.i(TAG, "deletePhotos called with " + urisToDelete.size() + " URIs, API level: " + Build.VERSION.SDK_INT);

            if (Build.VERSION.SDK_INT >= 30) {
                // Android 11+: Try direct deletion first, then createDeleteRequest for failures
                deleteWithConsentFallback(call, urisToDelete);
            } else {
                // Android 10 and below: Direct deletion
                deleteDirectly(call, urisToDelete);
            }
        } catch (Exception e) {
            Log.e(TAG, "Delete photos failed", e);
            call.reject("Delete failed: " + e.getMessage());
        }
    }

    /**
     * Android 11+ deletion strategy:
     * 1. Try ContentResolver.delete() for each URI (works for app-owned files)
     * 2. For URIs that need user consent, use MediaStore.createDeleteRequest()
     * 3. Properly handle activity result with timeout
     */
    private void deleteWithConsentFallback(PluginCall call, List<Uri> urisToDelete) {
        ContentResolver resolver = getContext().getContentResolver();
        List<Uri> needConsent = new ArrayList<>();
        int deleted = 0;
        int failed = 0;

        // Step 1: Try direct deletion for each URI
        for (Uri uri : urisToDelete) {
            try {
                int rows = resolver.delete(uri, null, null);
                if (rows > 0) {
                    deleted++;
                    Log.i(TAG, "Directly deleted: " + uri);
                } else {
                    // No rows deleted - might need consent
                    needConsent.add(uri);
                    Log.i(TAG, "No rows deleted, needs consent: " + uri);
                }
            } catch (RecoverableSecurityException e) {
                // Need user consent (API 29+) - catch BEFORE SecurityException since it extends it
                needConsent.add(uri);
                Log.i(TAG, "RecoverableSecurityException, needs consent: " + uri);
            } catch (SecurityException e) {
                // Need user consent for this URI
                needConsent.add(uri);
                Log.i(TAG, "SecurityException, needs consent: " + uri + " - " + e.getMessage());
            } catch (Exception e) {
                failed++;
                Log.w(TAG, "Error deleting " + uri + ": " + e.getMessage());
            }
        }

        Log.i(TAG, "Direct deletion: " + deleted + " deleted, " + needConsent.size() + " need consent, " + failed + " failed");

        // Step 2: If no consent needed, we're done
        if (needConsent.isEmpty()) {
            JSObject result = new JSObject();
            result.put("deleted", deleted);
            result.put("failed", failed);
            result.put("userCancelled", false);
            call.resolve(result);
            return;
        }

        // Step 3: Use createDeleteRequest() for URIs needing consent
        call.save();
        savedDeleteCall = call;
        savedDeleteUris = needConsent;
        preDeletedCount = deleted;
        preFailedCount = failed;

        getActivity().runOnUiThread(() -> {
            try {
                android.app.PendingIntent deletePendingIntent =
                    MediaStore.createDeleteRequest(
                        getContext().getContentResolver(),
                        needConsent
                    );

                Log.i(TAG, "createDeleteRequest succeeded for " + needConsent.size() + " URIs, launching system dialog");

                getActivity().startIntentSenderForResult(
                    deletePendingIntent.getIntentSender(),
                    DELETE_REQUEST_CODE,
                    null, 0, 0, 0
                );

                // Start timeout in case activity result is never received
                startDeleteTimeout();

            } catch (Exception e) {
                Log.e(TAG, "createDeleteRequest failed", e);
                // Can't get consent - report what we could delete directly
                resolveDeleteCall(preDeletedCount, preFailedCount + needConsent.size(), false, e.getMessage());
            }
        });
    }

    /**
     * Start a timeout for the delete request.
     * If the activity result is never received within the timeout,
     * we resolve the call with whatever we have.
     */
    private void startDeleteTimeout() {
        cancelDeleteTimeout();

        timeoutRunnable = () -> {
            if (savedDeleteCall != null) {
                Log.w(TAG, "Delete request timed out after " + DELETE_TIMEOUT_MS + "ms");
                int totalUris = savedDeleteUris != null ? savedDeleteUris.size() : 0;
                resolveDeleteCall(preDeletedCount, preFailedCount + totalUris, false, "Timeout waiting for user consent");
            }
        };

        timeoutHandler.postDelayed(timeoutRunnable, DELETE_TIMEOUT_MS);
    }

    private void cancelDeleteTimeout() {
        if (timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
            timeoutRunnable = null;
        }
    }

    /**
     * Resolve the saved delete call with the given results.
     * This is called from handleOnActivityResult, onDeleteResult, and timeout.
     */
    private synchronized void resolveDeleteCall(int deleted, int failed, boolean userCancelled, String error) {
        cancelDeleteTimeout();

        if (savedDeleteCall != null) {
            Log.i(TAG, "Resolving delete call: deleted=" + deleted + ", failed=" + failed +
                ", userCancelled=" + userCancelled + ", error=" + error);

            JSObject result = new JSObject();
            result.put("deleted", deleted);
            result.put("failed", failed);
            result.put("userCancelled", userCancelled);
            if (error != null) {
                result.put("error", error);
            }
            savedDeleteCall.resolve(result);
            savedDeleteCall = null;
            savedDeleteUris = null;
            preDeletedCount = 0;
            preFailedCount = 0;
        }
    }

    /**
     * Called by MainActivity.onActivityResult to forward results.
     * Also called by handleOnActivityResult from Capacitor bridge.
     */
    public void onDeleteResult(int requestCode, int resultCode, Intent data) {
        Log.i(TAG, "onDeleteResult: requestCode=" + requestCode + ", resultCode=" + resultCode +
            " (RESULT_OK=" + Activity.RESULT_OK + ", RESULT_CANCELED=" + Activity.RESULT_CANCELED + ")");

        if (requestCode != DELETE_REQUEST_CODE) return;
        if (savedDeleteCall == null) {
            Log.w(TAG, "onDeleteResult: no saved delete call");
            return;
        }

        int consentUrisCount = savedDeleteUris != null ? savedDeleteUris.size() : 0;

        if (resultCode == Activity.RESULT_OK) {
            // User confirmed - files are deleted by the system
            Log.i(TAG, "User confirmed deletion - " + consentUrisCount + " files deleted from device");
            resolveDeleteCall(preDeletedCount + consentUrisCount, preFailedCount, false, null);
        } else {
            // User cancelled or dialog dismissed
            Log.i(TAG, "User cancelled system delete dialog or dialog dismissed (resultCode=" + resultCode + ")");
            resolveDeleteCall(preDeletedCount, preFailedCount + consentUrisCount, true, null);
        }
    }

    /**
     * Handle activity result from Capacitor bridge.
     * This is the standard Capacitor way - might or might not be called depending on Capacitor version.
     */
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        Log.i(TAG, "handleOnActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        onDeleteResult(requestCode, resultCode, data);
    }

    /**
     * Android 10 and below: Delete directly via ContentResolver + file system.
     */
    private void deleteDirectly(PluginCall call, List<Uri> urisToDelete) {
        bridge.execute(() -> {
            int deleted = 0;
            int failed = 0;
            ContentResolver resolver = getContext().getContentResolver();

            for (Uri uri : urisToDelete) {
                try {
                    // First, try ContentResolver.delete()
                    int rows = resolver.delete(uri, null, null);
                    if (rows > 0) {
                        deleted++;
                        Log.i(TAG, "Deleted from MediaStore: " + uri);
                        continue;
                    }

                    // If ContentResolver didn't work, try file system deletion
                    String filePath = getFilePathFromUri(uri);
                    boolean fileDeleted = false;

                    if (filePath != null) {
                        File file = new File(filePath);
                        if (file.exists()) {
                            fileDeleted = file.delete();
                            Log.i(TAG, "File deletion " + (fileDeleted ? "succeeded" : "failed") + ": " + filePath);
                        }
                    }

                    if (fileDeleted) {
                        // Also try to remove from MediaStore database
                        try {
                            resolver.delete(uri, null, null);
                        } catch (Exception e) {
                            // Ignore - file is already deleted
                        }
                        deleted++;
                    } else {
                        failed++;
                        Log.w(TAG, "Failed to delete: " + uri);
                    }
                } catch (SecurityException e) {
                    Log.w(TAG, "SecurityException for " + uri + ": " + e.getMessage());
                    // On API 29, try file system as fallback
                    try {
                        String filePath = getFilePathFromUri(uri);
                        if (filePath != null) {
                            File file = new File(filePath);
                            if (file.exists() && file.delete()) {
                                deleted++;
                                Log.i(TAG, "Deleted via file system fallback: " + filePath);
                                continue;
                            }
                        }
                    } catch (Exception ex) {
                        // Ignore
                    }
                    failed++;
                } catch (Exception e) {
                    Log.w(TAG, "Exception deleting " + uri + ": " + e.getMessage());
                    failed++;
                }
            }

            final int finalDeleted = deleted;
            final int finalFailed = failed;

            getActivity().runOnUiThread(() -> {
                JSObject result = new JSObject();
                result.put("deleted", finalDeleted);
                result.put("failed", finalFailed);
                result.put("userCancelled", false);
                call.resolve(result);
            });
        });
    }

    /**
     * Get file path from content URI for direct file deletion
     */
    private String getFilePathFromUri(Uri uri) {
        String[] projection = { MediaStore.MediaColumns.DATA };
        try (Cursor cursor = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int dataIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA);
                return cursor.getString(dataIndex);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not get file path for URI: " + uri, e);
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // THUMBNAIL GENERATION
    // ═══════════════════════════════════════════════════════════

    @PluginMethod
    public void getThumbnail(PluginCall call) {
        String contentUriStr = call.getString("contentUri", "");
        int thumbSize = call.getInt("size", 200);

        if (contentUriStr.isEmpty()) {
            call.reject("contentUri is required");
            return;
        }

        bridge.execute(() -> {
            try {
                Uri uri = Uri.parse(contentUriStr);
                Bitmap thumbnail = null;

                if (Build.VERSION.SDK_INT >= 29) {
                    android.util.Size size = new android.util.Size(thumbSize, thumbSize);
                    thumbnail = getContext().getContentResolver().loadThumbnail(uri, size, null);
                } else {
                    try {
                        long id = ContentUris.parseId(uri);
                        thumbnail = MediaStore.Images.Thumbnails.getThumbnail(
                            getContext().getContentResolver(), id,
                            MediaStore.Images.Thumbnails.MINI_KIND, null);

                        if (thumbnail != null) {
                            double scale = Math.min(
                                (double) thumbSize / thumbnail.getWidth(),
                                (double) thumbSize / thumbnail.getHeight());
                            if (scale < 1.0) {
                                int newW = (int) (thumbnail.getWidth() * scale);
                                int newH = (int) (thumbnail.getHeight() * scale);
                                Bitmap scaled = Bitmap.createScaledBitmap(thumbnail, newW, newH, true);
                                thumbnail.recycle();
                                thumbnail = scaled;
                            }
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Fallback thumbnail failed", e);
                    }
                }

                if (thumbnail == null) {
                    call.reject("Could not generate thumbnail");
                    return;
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                thumbnail.compress(Bitmap.CompressFormat.JPEG, 70, baos);
                byte[] bytes = baos.toByteArray();
                String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                thumbnail.recycle();

                JSObject result = new JSObject();
                result.put("thumbnail", "data:image/jpeg;base64," + base64);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Failed to get thumbnail", e);
                call.reject("Failed to get thumbnail: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getThumbnailsBatch(PluginCall call) {
        JSArray urisArray = call.getArray("contentUris");
        int thumbSize = call.getInt("size", 200);

        bridge.execute(() -> {
            try {
                JSArray results = new JSArray();
                List<Object> uriList = urisArray.toList();

                for (int i = 0; i < uriList.size(); i++) {
                    String contentUriStr = (String) uriList.get(i);
                    try {
                        Uri uri = Uri.parse(contentUriStr);
                        Bitmap thumbnail = null;

                        if (Build.VERSION.SDK_INT >= 29) {
                            android.util.Size size = new android.util.Size(thumbSize, thumbSize);
                            thumbnail = getContext().getContentResolver().loadThumbnail(uri, size, null);
                        } else {
                            long id = ContentUris.parseId(uri);
                            thumbnail = MediaStore.Images.Thumbnails.getThumbnail(
                                getContext().getContentResolver(), id,
                                MediaStore.Images.Thumbnails.MINI_KIND, null);
                            if (thumbnail != null) {
                                double scale = Math.min(
                                    (double) thumbSize / thumbnail.getWidth(),
                                    (double) thumbSize / thumbnail.getHeight());
                                if (scale < 1.0) {
                                    int newW = (int) (thumbnail.getWidth() * scale);
                                    int newH = (int) (thumbnail.getHeight() * scale);
                                    Bitmap scaled = Bitmap.createScaledBitmap(thumbnail, newW, newH, true);
                                    thumbnail.recycle();
                                    thumbnail = scaled;
                                }
                            }
                        }

                        if (thumbnail != null) {
                            ByteArrayOutputStream baos = new ByteArrayOutputStream();
                            thumbnail.compress(Bitmap.CompressFormat.JPEG, 60, baos);
                            byte[] bytes = baos.toByteArray();
                            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                            thumbnail.recycle();

                            JSObject item = new JSObject();
                            item.put("contentUri", contentUriStr);
                            item.put("thumbnail", "data:image/jpeg;base64," + base64);
                            results.put(item);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Failed thumbnail for: " + contentUriStr, e);
                    }
                }

                JSObject result = new JSObject();
                result.put("thumbnails", results);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Batch thumbnail failed", e);
                call.reject("Batch thumbnail failed: " + e.getMessage());
            }
        });
    }
}
