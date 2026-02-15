import Capacitor
import AVFoundation

@objc(AudioRoutePlugin)
public class AudioRoutePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioRoutePlugin"
    public let jsName = "AudioRoute"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "forceSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "useDefaultRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentRoute", returnType: CAPPluginReturnPromise),
    ]

    @objc func forceSpeaker(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.defaultToSpeaker, .mixWithOthers]
                )
                try session.overrideOutputAudioPort(.speaker)
                print("✓ AudioRoute: Forced speaker output")
                let route = session.currentRoute.outputs.map { $0.portName }
                call.resolve(["output": route.first ?? "unknown"])
            } catch {
                print("✗ AudioRoute: Failed to force speaker: \(error)")
                call.reject("Failed to force speaker: \(error.localizedDescription)")
            }
        }
    }

    @objc func useDefaultRoute(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(
                    .playback,
                    mode: .default,
                    options: [.mixWithOthers]
                )
                print("✓ AudioRoute: Restored default routing")
                let route = session.currentRoute.outputs.map { $0.portName }
                call.resolve(["output": route.first ?? "unknown"])
            } catch {
                print("✗ AudioRoute: Failed to restore routing: \(error)")
                call.reject("Failed to restore routing: \(error.localizedDescription)")
            }
        }
    }

    @objc func getCurrentRoute(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map { [
            "name": $0.portName,
            "type": $0.portType.rawValue,
        ] }
        call.resolve(["outputs": outputs])
    }
}
