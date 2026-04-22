package ae.binnoma.cleanup;

import android.content.Intent;
import android.os.Bundle;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * Explicitly forward activity results to our MediaScannerPlugin.
     *
     * This ensures the delete confirmation dialog result reaches the plugin,
     * even if Capacitor's bridge doesn't properly route it via handleOnActivityResult.
     * We call our plugin FIRST, then let Capacitor's bridge handle it as well
     * (which will also call handleOnActivityResult - but that's safe because
     * resolveDeleteCall is synchronized and idempotent after first call).
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        // Forward to our plugin explicitly
        MediaScannerPlugin plugin = MediaScannerPlugin.getInstance();
        if (plugin != null) {
            plugin.onDeleteResult(requestCode, resultCode, data);
        }
        // Also let Capacitor bridge handle it (will call handleOnActivityResult)
        super.onActivityResult(requestCode, resultCode, data);
    }
}
