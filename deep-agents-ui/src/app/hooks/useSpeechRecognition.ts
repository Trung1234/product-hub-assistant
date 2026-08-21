"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface UseSpeechRecognitionOptions {
  onTranscript?: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({
  onTranscript,
  lang = "vi-VN",
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error(
        "Trình duyệt không hỗ trợ Web Speech API. Vui lòng dùng Chrome hoặc Edge."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Đang lắng nghe giọng nói... Hãy nói ý tưởng POD của bạn!");
      };

      recognition.onresult = (event: any) => {
        const transcriptText = event.results?.[0]?.[0]?.transcript;
        if (transcriptText && onTranscript) {
          onTranscript(transcriptText);
          toast.success("Đã ghi nhận giọng nói thành công!");
        }
      };

      recognition.onerror = (event: any) => {
        loggerError("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          toast.error(`Lỗi nhận diện giọng nói: ${event.error}`);
        }
        stopListening();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      loggerError("Failed to start speech recognition:", err);
      toast.error("Không thể khởi động Microphone. Vui lòng cấp quyền truy cập.");
      setIsListening(false);
    }
  }, [lang, onTranscript, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
    toggleListening,
  };
}

function loggerError(...args: any[]) {
  if (process.env.NODE_ENV !== "production") {
    console.error(...args);
  }
}
