"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import {
  MAX_QUIZ_INTERESTS,
  QUIZ_INTEREST_OPTIONS,
  QUIZ_QUESTIONS,
  scoreQuiz,
  type QuizAnswers,
  type QuizResult,
} from "@/lib/profile/personality-quiz";

const INTEREST_STEP = 3;
const TOTAL_STEPS = QUIZ_QUESTIONS.length + 1;

export function QuizForm({
  existingInterests,
  existingFood,
}: {
  existingInterests: string[];
  existingFood: string | null;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({ interests: [] });
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interests = answers.interests ?? [];

  function choose(key: (typeof QUIZ_QUESTIONS)[number]["key"], value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // Interests sit between spend/crowds and food — questions 0-2 come first, then interests, then food.
    setStep((s) => s + 1);
  }

  function toggleInterest(value: string) {
    setAnswers((prev) => {
      const current = prev.interests ?? [];
      if (current.includes(value)) return { ...prev, interests: current.filter((i) => i !== value) };
      if (current.length >= MAX_QUIZ_INTERESTS) return prev;
      return { ...prev, interests: [...current, value] };
    });
  }

  async function finish(finalAnswers: QuizAnswers) {
    const scored = scoreQuiz(finalAnswers, existingInterests);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travelStyle: scored.travelStyle,
          foodPreference: scored.foodPreference ?? existingFood ?? undefined,
          interests: scored.interests,
        }),
      });
      if (!res.ok) {
        setError("Couldn't save your result. Please try again.");
        return;
      }
      setResult(scored);
    } catch {
      setError("Couldn't save your result. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>You&apos;re a</CardDescription>
          <CardTitle className="text-2xl">{result.typeName}</CardTitle>
          <CardDescription>{result.travelStyle.split(" — ")[1]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Saved to your profile. The assistant will use this for every new plan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/chat">Plan a trip</Link>} />
            <Button variant="outline" nativeButton={false} render={<Link href="/profile">Back to profile</Link>} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step order: pace, spend, crowds, interests, food.
  const questionIndex = step < INTEREST_STEP ? step : step - 1;
  const isInterestStep = step === INTEREST_STEP;
  const question = isInterestStep ? null : QUIZ_QUESTIONS[questionIndex];

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Question {step + 1} of {TOTAL_STEPS}
        </CardDescription>
        <CardTitle>{isInterestStep ? `Pick up to ${MAX_QUIZ_INTERESTS} things you love` : question?.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isInterestStep ? (
          <>
            <div className="flex flex-wrap gap-2">
              {QUIZ_INTEREST_OPTIONS.map((option) => {
                const selected = interests.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleInterest(option)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <Button className="mt-2 self-start" disabled={interests.length === 0} onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          </>
        ) : (
          question?.options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => {
                if (question.key === "food") {
                  void finish({ ...(answers as QuizAnswers), food: option.value as QuizAnswers["food"] });
                } else {
                  choose(question.key, option.value);
                }
              }}
              className="rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60"
            >
              {option.label}
            </button>
          ))
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {step > 0 && !saving && (
          <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
