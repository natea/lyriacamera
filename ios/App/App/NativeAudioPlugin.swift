import Capacitor
import AVFoundation

@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioPlugin"
    public let jsName = "NativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendAudioChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forceSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "useDefaultRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentRoute", returnType: CAPPluginReturnPromise),
    ]

    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var audioFormat: AVAudioFormat?
    private var isSetUp = false
    private var hasStartedPlayback = false
    private var bufferedChunks: [AVAudioPCMBuffer] = []
    private var playbackTimer: Timer?
    private let bufferTimeSeconds = 2.0
    private let bufferQueue = DispatchQueue(label: "com.lyria.audio.buffer")

    @objc func setup(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Tear down existing engine if re-setting up
            if self.isSetUp {
                self.playerNode?.stop()
                self.audioEngine?.stop()
                self.playbackTimer?.invalidate()
                self.playbackTimer = nil
                NotificationCenter.default.removeObserver(
                    self,
                    name: .AVAudioEngineConfigurationChange,
                    object: self.audioEngine
                )
            }

            do {
                let engine = AVAudioEngine()
                let player = AVAudioPlayerNode()

                // 48kHz stereo Float32 (non-interleaved, standard format)
                guard let format = AVAudioFormat(
                    standardFormatWithSampleRate: 48000,
                    channels: 2
                ) else {
                    call.reject("Failed to create audio format")
                    return
                }

                engine.attach(player)
                engine.connect(player, to: engine.mainMixerNode, format: format)

                try engine.start()

                self.audioEngine = engine
                self.playerNode = player
                self.audioFormat = format
                self.isSetUp = true
                self.hasStartedPlayback = false
                self.bufferedChunks = []

                // Listen for engine configuration changes (e.g., route changes)
                NotificationCenter.default.addObserver(
                    self,
                    selector: #selector(self.handleEngineConfigChange),
                    name: .AVAudioEngineConfigurationChange,
                    object: engine
                )

                print("✓ NativeAudio: Engine started (48kHz stereo)")
                call.resolve()
            } catch {
                print("✗ NativeAudio: Failed to start engine: \(error)")
                call.reject("Failed to start audio engine: \(error.localizedDescription)")
            }
        }
    }

    @objc func sendAudioChunk(_ call: CAPPluginCall) {
        guard let base64Data = call.getString("data"),
              let format = self.audioFormat,
              let player = self.playerNode else {
            call.reject("Not set up or missing data")
            return
        }

        bufferQueue.async {
            guard let rawData = Data(base64Encoded: base64Data) else {
                call.reject("Invalid base64 data")
                return
            }

            // Data is Int16 interleaved stereo at 48kHz
            let int16Count = rawData.count / 2
            let samplesPerChannel = int16Count / 2  // stereo

            guard samplesPerChannel > 0,
                  let pcmBuffer = AVAudioPCMBuffer(
                      pcmFormat: format,
                      frameCapacity: AVAudioFrameCount(samplesPerChannel)
                  ) else {
                call.reject("Failed to create PCM buffer")
                return
            }

            pcmBuffer.frameLength = AVAudioFrameCount(samplesPerChannel)

            // Convert Int16 interleaved to Float32 deinterleaved
            rawData.withUnsafeBytes { rawBuffer in
                let int16Ptr = rawBuffer.bindMemory(to: Int16.self)
                guard let leftChannel = pcmBuffer.floatChannelData?[0],
                      let rightChannel = pcmBuffer.floatChannelData?[1] else {
                    return
                }

                for i in 0..<samplesPerChannel {
                    leftChannel[i] = Float(int16Ptr[i * 2]) / 32768.0
                    rightChannel[i] = Float(int16Ptr[i * 2 + 1]) / 32768.0
                }
            }

            if self.hasStartedPlayback {
                // Already playing - just queue the buffer
                player.scheduleBuffer(pcmBuffer)
            } else {
                // Buffering phase - collect chunks before starting playback
                self.bufferedChunks.append(pcmBuffer)

                // Start a timer on the first chunk
                if self.bufferedChunks.count == 1 {
                    DispatchQueue.main.async {
                        self.playbackTimer = Timer.scheduledTimer(
                            withTimeInterval: self.bufferTimeSeconds,
                            repeats: false
                        ) { [weak self] _ in
                            self?.startPlayback()
                        }
                    }
                }
            }

            call.resolve()
        }
    }

    private func startPlayback() {
        guard let player = playerNode else { return }

        bufferQueue.async {
            // Schedule all buffered chunks
            for buffer in self.bufferedChunks {
                player.scheduleBuffer(buffer)
            }
            self.bufferedChunks.removeAll()
            self.hasStartedPlayback = true

            DispatchQueue.main.async {
                player.play()
                print("✓ NativeAudio: Started playback")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.playbackTimer?.invalidate()
            self.playbackTimer = nil
            self.playerNode?.stop()
            self.hasStartedPlayback = false
            self.bufferedChunks = []
            print("✓ NativeAudio: Stopped")
            call.resolve()
        }
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        guard let engine = self.audioEngine else {
            call.reject("Not set up")
            return
        }

        let volume = call.getFloat("volume") ?? 1.0
        engine.mainMixerNode.outputVolume = volume
        call.resolve()
    }

    @objc func forceSpeaker(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                let wasPlaying = self.hasStartedPlayback

                // Pause engine before route change
                self.playerNode?.pause()
                self.audioEngine?.pause()

                // Switch to playAndRecord + force speaker
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.defaultToSpeaker, .mixWithOthers]
                )
                try session.overrideOutputAudioPort(.speaker)
                try session.setActive(true)

                // Restart engine under new category
                try self.audioEngine?.start()
                if wasPlaying {
                    self.playerNode?.play()
                }

                print("✓ NativeAudio: Forced speaker output")
                let route = session.currentRoute.outputs.map { $0.portName }
                call.resolve(["output": route.first ?? "unknown"])
            } catch {
                // Try to restart engine even if route change failed
                try? self.audioEngine?.start()
                if self.hasStartedPlayback {
                    self.playerNode?.play()
                }
                print("✗ NativeAudio: Failed to force speaker: \(error)")
                call.reject("Failed to force speaker: \(error.localizedDescription)")
            }
        }
    }

    @objc func useDefaultRoute(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                let wasPlaying = self.hasStartedPlayback

                self.playerNode?.pause()
                self.audioEngine?.pause()

                try session.setCategory(
                    .playback,
                    mode: .default,
                    options: [.mixWithOthers]
                )
                try session.setActive(true)

                try self.audioEngine?.start()
                if wasPlaying {
                    self.playerNode?.play()
                }

                print("✓ NativeAudio: Restored default routing")
                let route = session.currentRoute.outputs.map { $0.portName }
                call.resolve(["output": route.first ?? "unknown"])
            } catch {
                try? self.audioEngine?.start()
                if self.hasStartedPlayback {
                    self.playerNode?.play()
                }
                print("✗ NativeAudio: Failed to restore routing: \(error)")
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

    @objc private func handleEngineConfigChange(notification: Notification) {
        print("⚠️ NativeAudio: Engine configuration changed, restarting...")
        guard let engine = self.audioEngine else { return }
        do {
            try engine.start()
            if self.hasStartedPlayback {
                self.playerNode?.play()
            }
            print("✓ NativeAudio: Engine restarted after config change")
        } catch {
            print("✗ NativeAudio: Failed to restart engine: \(error)")
        }
    }

    deinit {
        playbackTimer?.invalidate()
        playerNode?.stop()
        audioEngine?.stop()
        NotificationCenter.default.removeObserver(self)
    }
}
