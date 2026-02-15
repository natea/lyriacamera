#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeAudioPlugin, "NativeAudio",
    CAP_PLUGIN_METHOD(setup, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(sendAudioChunk, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setVolume, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(forceSpeaker, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(useDefaultRoute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getCurrentRoute, CAPPluginReturnPromise);
)
