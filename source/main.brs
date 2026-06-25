sub Main()
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.SetMessagePort(m.port)

    scene = screen.CreateScene("MainScene")
    screen.Show()

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
    di = CreateObject("roDeviceInfo")
    addrs = di.GetIPAddrs()
    localIp = ""
    for each interface in addrs
        localIp = addrs[interface]
    end for

    if localIp <> ""
        request = CreateObject("roUrlTransfer")
        request.SetUrl("http://100.104.161.54:18000/api/register") ' Use Tailnet IP for prototype
        request.SetRequest("POST")
        request.AddHeader("Content-Type", "application/json")
        
        body = { localIp: localIp }
        request.AsyncPostFromString(FormatJson(body))
        print "[Quickbeam] Heartbeat sent: " + localIp
    end if
end function
