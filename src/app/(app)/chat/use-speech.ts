"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { splitIntoChunks, toSpeakableText } from "@/lib/speech/speakable-text";

const AUTO_READ_KEY = "tt-auto-read";
const AUTO_READ_EVENT = "tt-auto-read-change";

function subscribeAutoRead(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTO_READ_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTO_READ_EVENT, callback);
  };
}

function readAutoRead(): boolean {
  try {
    return localStorage.getItem(AUTO_READ_KEY) === "1";
  } catch {
    return false;
  }
}

export function useAutoRead(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribeAutoRead, readAutoRead, () => false);
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(AUTO_READ_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable — the toggle just won't persist
    }
    window.dispatchEvent(new Event(AUTO_READ_EVENT));
  }, []);
  return [value, set];
}

export function useSpeech() {
  const supported = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const runRef = useRef(0);

  const stop = useCallback(() => {
    runRef.current++;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, []);

  const speak = useCallback((key: string, markdown: string) => {
    if (!("speechSynthesis" in window)) return;
    const chunks = splitIntoChunks(toSpeakableText(markdown));
    if (chunks.length === 0) return;

    window.speechSynthesis.cancel();
    const run = ++runRef.current;
    setSpeakingKey(key);

    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = navigator.language || "en-US";
      const finish = () => {
        if (runRef.current === run && i === chunks.length - 1) setSpeakingKey(null);
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  useEffect(
    () => () => {
      runRef.current++;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, speakingKey, speak, stop };
}
