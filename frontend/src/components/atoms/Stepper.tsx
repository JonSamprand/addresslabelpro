import type { AppStep } from "@/types";

const STEPS: { key: AppStep; label: string; number: number }[] = [
  { key: "upload", label: "Upload", number: 1 },
  { key: "map", label: "Map Fields", number: 2 },
  { key: "design", label: "Design", number: 3 },
  { key: "review", label: "Review", number: 4 },
  { key: "download", label: "Download", number: 5 },
];

interface StepperProps {
  currentStep: AppStep;
}

export function Stepper({ currentStep }: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isComplete ? "bg-blue-600 text-white" : ""}
                  ${isCurrent ? "bg-blue-600 text-white ring-2 ring-blue-300" : ""}
                  ${!isComplete && !isCurrent ? "bg-gray-200 text-gray-500" : ""}
                `}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span className={`text-sm ${isCurrent ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="w-12 h-px bg-gray-300 mx-2" />}
          </div>
        );
      })}
    </div>
  );
}
