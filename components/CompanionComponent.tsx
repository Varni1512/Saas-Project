'use client';

import { useEffect, useRef, useState } from 'react'
import { cn, configureAssistant, getSubjectColor } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import Image from "next/image";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import soundwaves from '@/constants/soundwaves.json'
import { addToSessionHistory } from "@/lib/actions/companion.actions";

enum CallStatus {
    INACTIVE = 'INACTIVE',
    CONNECTING = 'CONNECTING',
    ACTIVE = 'ACTIVE',
    FINISHED = 'FINISHED',
}

const CompanionComponent = ({ companionId, subject, topic, name, userName, userImage, style, voice }: CompanionComponentProps) => {
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [messages, setMessages] = useState<SavedMessage[]>([]);

    const lottieRef = useRef<LottieRefCurrentProps>(null);

    useEffect(() => {
        if (lottieRef) {
            if (isSpeaking) {
                lottieRef.current?.play()
            } else {
                lottieRef.current?.stop()
            }
        }
    }, [isSpeaking, lottieRef])

    useEffect(() => {
        const onCallStart = () => setCallStatus(CallStatus.ACTIVE);

        const onCallEnd = () => {
            setCallStatus(CallStatus.FINISHED);
            addToSessionHistory(companionId)
        }

        const onMessage = (message: Message) => {
            if (message.type === 'transcript' && message.transcriptType === 'final') {
                const newMessage = { role: message.role, content: message.transcript }
                setMessages((prev) => [...prev, newMessage])
            }
        }

        const onSpeechStart = () => setIsSpeaking(true);
        const onSpeechEnd = () => setIsSpeaking(false);

        const onError = (error: Error) => console.log('Error', error);

        vapi.on('call-start', onCallStart);
        vapi.on('call-end', onCallEnd);
        vapi.on('message', onMessage);
        vapi.on('error', onError);
        vapi.on('speech-start', onSpeechStart);
        vapi.on('speech-end', onSpeechEnd);

        return () => {
            vapi.off('call-start', onCallStart);
            vapi.off('call-end', onCallEnd);
            vapi.off('message', onMessage);
            vapi.off('error', onError);
            vapi.off('speech-start', onSpeechStart);
            vapi.off('speech-end', onSpeechEnd);
        }
    }, []);

    const toggleMicrophone = () => {
        const isMuted = vapi.isMuted();
        vapi.setMuted(!isMuted);
        setIsMuted(!isMuted)
    }

    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING)

        const assistantOverrides = {
            variableValues: { subject, topic, style },
            clientMessages: ["transcript"],
            serverMessages: [],
        }

        // @ts-expect-error
        vapi.start(configureAssistant(voice, style), assistantOverrides)
    }

    const handleDisconnect = () => {
        setCallStatus(CallStatus.FINISHED)
        vapi.stop()
    }

    return (
        <section className="flex flex-col h-[70vh]">
            <section className="flex gap-8 max-sm:flex-col">
                <div className="companion-section">
                    <div className="companion-avatar" style={{ backgroundColor: getSubjectColor(subject) }}>
                        <div
                            className={
                                cn(
                                    'absolute transition-opacity duration-1000', callStatus === CallStatus.FINISHED || callStatus === CallStatus.INACTIVE ? 'opacity-100' : 'opacity-0', callStatus === CallStatus.CONNECTING && 'opacity-100 animate-pulse'
                                )
                            }>
                            <Image src={`/icons/${subject}.svg`} alt={subject} width={150} height={150} className="max-sm:w-fit" />
                        </div>

                        <div className={cn('absolute transition-opacity duration-1000', callStatus === CallStatus.ACTIVE ? 'opacity-100' : 'opacity-0')}>
                            <Lottie
                                lottieRef={lottieRef}
                                animationData={soundwaves}
                                autoplay={false}
                                className="companion-lottie"
                            />
                        </div>
                    </div>
                    <p className="font-bold text-2xl">{name}</p>
                </div>

                <div className="user-section">
                    <div className="user-avatar">
                        <Image src={userImage} alt={userName} width={130} height={130} className="rounded-lg" />
                        <p className="font-bold text-2xl">
                            {userName}
                        </p>
                    </div>
                    <button className="btn-mic" onClick={toggleMicrophone} disabled={callStatus !== CallStatus.ACTIVE}>
                        <Image src={isMuted ? '/icons/mic-off.svg' : '/icons/mic-on.svg'} alt="mic" width={36} height={36} />
                        <p className="max-sm:hidden">
                            {isMuted ? 'Turn on microphone' : 'Turn off microphone'}
                        </p>
                    </button>
                    <button className={cn('rounded-lg py-2 cursor-pointer transition-colors w-full text-white', callStatus === CallStatus.ACTIVE ? 'bg-red-700' : 'bg-primary', callStatus === CallStatus.CONNECTING && 'animate-pulse')} onClick={callStatus === CallStatus.ACTIVE ? handleDisconnect : handleCall}>
                        {callStatus === CallStatus.ACTIVE
                            ? "End Session"
                            : callStatus === CallStatus.CONNECTING
                                ? 'Connecting'
                                : 'Start Session'
                        }
                    </button>
                </div>
            </section>

            {/* Enhanced Transcript Section */}
            <section className="w-full mt-6 flex-1 min-h-0">
                <div className="w-full h-full flex flex-col">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Conversation Transcript</h3>
                    <div
                        className="flex-1 w-full bg-gray-50 rounded-lg border p-4 overflow-y-auto"
                        style={{ minHeight: '300px' }}
                        ref={(el) => {
                            if (el && messages.length > 0) {
                                el.scrollTop = el.scrollHeight;
                            }
                        }}
                    >
                        {messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <div className="text-center">
                                    <p className="text-base">No messages yet. Start a session to see the conversation transcript.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {messages.map((message, index) => {
                                    if (message.role === 'assistant') {
                                        return (
                                            <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
                                                <p className="max-sm:text-sm">
                                                    <span className="font-semibold text-blue-600">
                                                        {name.split(' ')[0].replace(/[.,]/g, '')}:
                                                    </span>
                                                    {' '}{message.content}
                                                </p>
                                            </div>
                                        )
                                    } else {
                                        return (
                                            <div key={index} className="bg-blue-50 p-3 rounded-lg shadow-sm">
                                                <p className="text-primary max-sm:text-sm">
                                                    <span className="font-semibold">
                                                        {userName}:
                                                    </span>
                                                    {' '}{message.content}
                                                </p>
                                            </div>
                                        )
                                    }
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </section>
    )
}

export default CompanionComponent
