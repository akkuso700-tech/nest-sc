import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { connectSocketClient, disconnectSocketClient } from '../services/socketClient.js'
import { useWebRTCCall } from '../hooks/useWebRTCCall.js'
import IncomingCallModal from '../components/calling/IncomingCallModal.jsx'
import CallModal from '../components/calling/CallModal.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'

const CallContext = createContext(null)

export function CallProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [toast, setToast] = useState(null)

  // Ensure socket stays connected whenever user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return undefined
    connectSocketClient()
    return () => {
      disconnectSocketClient()
    }
  }, [isAuthenticated])

  const callManager = useWebRTCCall()

  const {
    callState,
    activeCall,
    incomingCall,
    callDuration,
    isMuted,
    isVideoOff,
    isPeerMuted,
    isPeerVideoOff,
    isMinimized,
    errorMessage: callErrorMessage,
    setErrorMessage: setCallErrorMessage,
    localStream,
    remoteStream,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleMinimize,
  } = callManager

  useEffect(() => {
    if (callErrorMessage) {
      setToast({ tone: 'error', message: callErrorMessage })
      setCallErrorMessage(null)
    }
  }, [callErrorMessage, setCallErrorMessage])

  return (
    <CallContext.Provider value={callManager}>
      {children}

      {/* Global Incoming Call Dialog (appears on all pages when someone calls) */}
      {incomingCall ? (
        <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={acceptIncomingCall}
          onDecline={() => rejectIncomingCall('declined')}
        />
      ) : null}

      {/* Global Active Call Interface (Full or Floating PiP widget) */}
      {activeCall ? (
        <CallModal
          activeCall={activeCall}
          callState={callState}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isPeerMuted={isPeerMuted}
          isPeerVideoOff={isPeerVideoOff}
          isMinimized={isMinimized}
          localStream={localStream}
          remoteStream={remoteStream}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleMinimize={toggleMinimize}
          onEndCall={endCall}
        />
      ) : null}

      {toast ? (
        <ActionToast toast={toast} onClose={() => setToast(null)} />
      ) : null}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error('useCall must be used within a CallProvider')
  }
  return context
}
