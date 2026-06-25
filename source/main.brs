sub Main()
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.SetMessagePort(m.port)

    scene = screen.CreateScene("MainScene")
    screen.Show()

    globalAA = GetGlobalAA()

    ' 1. Generate 6-digit pairing code
    pairingCode = ""
    for i = 1 to 6
        digit = Rnd(10) - 1
        pairingCode = pairingCode + Stri(digit).Trim()
    end for
    globalAA.pairingCode = pairingCode

    ' 2. Setup device identity
    di = CreateObject("roDeviceInfo")
    globalAA.deviceId = di.GetChannelClientId()
    
    deviceName = di.GetFriendlyName()
    if deviceName = "" then deviceName = di.GetModelDisplayName()
    if deviceName = "" then deviceName = "Roku TV"
    globalAA.deviceName = deviceName

    ' 3. Relay URL configuration (Production Cloud Run URL)
    globalAA.relayUrl = "https://quickbeam-relay-470817308605.us-central1.run.app"

    ' 4. Pass connection settings to SceneGraph
    scene.pairingCode = globalAA.pairingCode
    scene.relayUrl = globalAA.relayUrl

    ' Start the Heartbeat to Relay
    timer = CreateObject("roTimer")
    timer.SetMessagePort(m.port)
    timer.SetDuration(30, true) ' Every 30 seconds
    timer.Start()

    ' Initial registration
    RegisterWithRelay()

    while(true)
        msg = wait(0, m.port)
        msgType = type(msg)
        if msgType = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        else if msgType = "roTimerEvent"
            RegisterWithRelay()
        end if
    end while
end sub

function RegisterWithRelay()
    globalAA = GetGlobalAA()
    di = CreateObject("roDeviceInfo")
    addrs = di.GetIPAddrs()
    localIp = ""
    for each interface in addrs
        localIp = addrs[interface]
    end for

    if localIp <> ""
        request = CreateObject("roUrlTransfer")
        request.SetUrl(globalAA.relayUrl + "/api/register")
        request.SetRequest("POST")
        request.AddHeader("Content-Type", "application/json")
        
        body = { 
            localIp: localIp,
            deviceId: globalAA.deviceId,
            deviceName: globalAA.deviceName,
            pairingCode: globalAA.pairingCode
        }
        request.AsyncPostFromString(FormatJson(body))
        print "[Quickbeam] Heartbeat sent: " + localIp + " (Code: " + globalAA.pairingCode + ")"
    end if
end function
