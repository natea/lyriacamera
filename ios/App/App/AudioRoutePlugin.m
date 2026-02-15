#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AudioRoutePlugin, "AudioRoute",
    CAP_PLUGIN_METHOD(forceSpeaker, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(useDefaultRoute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getCurrentRoute, CAPPluginReturnPromise);
)
