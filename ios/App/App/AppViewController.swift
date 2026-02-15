import Capacitor

class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioRoutePlugin())
        bridge?.registerPluginInstance(NativeAudioPlugin())
    }
}
