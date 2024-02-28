import { MultiStepInput, MultiStepState } from "src/multiStepInputs/multiStepHelper";

export type NextStepCB = (
  input: MultiStepInput,
  state: Partial<MultiStepState>,
  options: CommonInputOptions,
) => NextStepCB | void;

export type CommonInputOptions = {
  title: string,
  stepNumber: number,
  totalSteps: number,
  nextStep: NextStepCB,
};
