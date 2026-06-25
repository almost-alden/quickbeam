sub init()
    m.top.setFocus(true)
    
    ' Resolve UI references
    m.pairingCodeLabel = m.top.findNode("pairingCodeLabel")
    m.qrCodePoster = m.top.findNode("qrCodePoster")
    m.statusLabel = m.top.findNode("statusLabel")
end sub

sub onPairingCodeChange()
    code = m.top.pairingCode
    if code <> "" and code <> invalid
        ' Format code as "123 456" for better TV viewing legibility
        formattedCode = code.left(3) + " " + code.right(3)
        m.pairingCodeLabel.text = formattedCode
        updateQR()
    end if
end sub

sub onRelayUrlChange()
    updateQR()
end sub

sub updateQR()
    code = m.top.pairingCode
    url = m.top.relayUrl
    if code <> "" and code <> invalid and url <> "" and url <> invalid
        ' Point the QR code directly to the magic page with the pre-filled code parameter
        qrData = url + "/magic.html?code=" + code
        
        ' Set the Poster node's URI to fetch the generated QR code dynamically
        m.qrCodePoster.uri = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + qrData
        m.statusLabel.text = "Registered! Ready to connect."
    end if
end sub
