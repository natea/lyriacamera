import UIKit
import AVFoundation
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure audio session for playback alongside camera (getUserMedia).
        // .playback + .mixWithOthers is the known-working config for WKWebView Web Audio API.
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try audioSession.setActive(true)
            print("✓ Audio session configured")
            print("  Category: \(audioSession.category.rawValue)")
            print("  Route outputs: \(audioSession.currentRoute.outputs.map { "\($0.portName) (\($0.portType.rawValue))" })")
        } catch {
            print("✗ Failed to configure audio session: \(error)")
        }

        // Listen for audio session interruptions
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioSessionInterruption),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )

        // Log route changes for diagnostics (no action taken)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )

        // Configure WKWebView media playback after a delay to ensure it's initialized
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.configureWebView()
        }

        return true
    }

    func configureWebView() {
        guard let bridgeViewController = self.window?.rootViewController as? CAPBridgeViewController,
              let webView = bridgeViewController.webView else {
            print("⚠️ WebView not yet available, will retry")
            // Retry after another delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.configureWebView()
            }
            return
        }
        
        webView.configuration.allowsInlineMediaPlayback = true
        webView.configuration.mediaTypesRequiringUserActionForPlayback = []
        print("✓ WebView media playback configured")
    }
    
    @objc func handleRouteChange(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        let route = AVAudioSession.sharedInstance().currentRoute
        let outputPorts = route.outputs.map { "\($0.portName) (\($0.portType.rawValue))" }
        print("🔊 Route changed (reason: \(reason.rawValue)): outputs = \(outputPorts)")
    }

    @objc func handleAudioSessionInterruption(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }
        
        switch type {
        case .began:
            print("⚠️ Audio session interrupted")
        case .ended:
            print("✓ Audio session interruption ended")
            // Reactivate the audio session
            do {
                try AVAudioSession.sharedInstance().setActive(true)
                print("✓ Audio session reactivated after interruption")
            } catch {
                print("✗ Failed to reactivate audio session: \(error)")
            }
        @unknown default:
            break
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            print("✓ Audio session reactivated on app becoming active")
        } catch {
            print("✗ Failed to reactivate audio session: \(error)")
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
