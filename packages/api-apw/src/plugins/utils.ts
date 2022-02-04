import get from "lodash/get";
import { customAlphabet } from "nanoid";
import { CmsModelField } from "@webiny/api-headless-cms/types";
import { SecurityIdentity } from "@webiny/api-security/types";
import {
    ApwChangeRequest,
    ApwContentReview,
    ApwContentReviewCrud,
    ApwContentReviewStep,
    ApwContentReviewStepStatus,
    ApwReviewerCrud,
    ApwWorkflowStep,
    ApwWorkflowStepTypes
} from "~/types";

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const getNanoid = customAlphabet(ALPHANUMERIC, 10);

export interface CreateModelFieldParams extends Omit<CmsModelField, "id" | "fieldId"> {
    parent: string;
}

export interface HasReviewersParams {
    identity: SecurityIdentity;
    step: ApwContentReviewStep;
    getReviewer: ApwReviewerCrud["get"];
}

export const hasReviewer = async ({
    getReviewer,
    identity,
    step
}: HasReviewersParams): Promise<Boolean> => {
    for (const stepReviewer of step.reviewers) {
        const entry = await getReviewer(stepReviewer.id);

        if (entry.identityId === identity.id) {
            return true;
        }
    }

    return false;
};

export const getValue = (object: Record<string, any>, key: string) => {
    return get(object, `values.${key}`);
};

export const getContentReviewStepInitialStatus = (
    workflowSteps: ApwWorkflowStep[],
    index: number,
    previousStepStatus: ApwContentReviewStepStatus
): ApwContentReviewStepStatus => {
    /**
     * Always set first step 'active' by default.
     */
    if (index === 0) {
        return ApwContentReviewStepStatus.ACTIVE;
    }

    const previousStep = workflowSteps[index - 1];
    if (
        previousStepStatus === ApwContentReviewStepStatus.ACTIVE &&
        previousStep.type !== ApwWorkflowStepTypes.MANDATORY_BLOCKING
    ) {
        return ApwContentReviewStepStatus.ACTIVE;
    }

    return ApwContentReviewStepStatus.INACTIVE;
};

export const getNextStepStatus = (
    previousStepType: ApwWorkflowStepTypes,
    previousStepStatus: ApwContentReviewStepStatus
): ApwContentReviewStepStatus => {
    if (previousStepStatus === ApwContentReviewStepStatus.DONE) {
        return ApwContentReviewStepStatus.ACTIVE;
    }

    if (
        previousStepStatus === ApwContentReviewStepStatus.ACTIVE &&
        previousStepType !== ApwWorkflowStepTypes.MANDATORY_BLOCKING
    ) {
        return ApwContentReviewStepStatus.ACTIVE;
    }

    return ApwContentReviewStepStatus.INACTIVE;
};

export interface ExtractContentReviewIdAndStepResult {
    id: string;
    stepId: string;
}

export const extractContentReviewIdAndStep = (
    step: ApwChangeRequest["step"]
): ExtractContentReviewIdAndStepResult => {
    /*
     * Get associated content review entry.
     */
    const [entryId, version, stepId] = step.split("#");
    const revisionId = `${entryId}#${version}`;

    return {
        id: revisionId,
        stepId
    };
};

export interface UpdateContentReviewParams {
    id: string;
    contentReviewMethods: ApwContentReviewCrud;
    getNewContentReviewData: (entry: ApwContentReview) => ApwContentReview;
}

export const updateContentReview = async ({
    contentReviewMethods,
    id,
    getNewContentReviewData
}: UpdateContentReviewParams): Promise<void> => {
    let contentReviewEntry: ApwContentReview;
    try {
        contentReviewEntry = await contentReviewMethods.get(id);
    } catch (e) {
        if (e.message !== "index_not_found_exception" && e.code !== "NOT_FOUND") {
            throw e;
        }
    }
    if (contentReviewEntry) {
        const newContentReviewData = getNewContentReviewData(contentReviewEntry);
        /**
         * Update content review entry.
         */
        await contentReviewMethods.update(contentReviewEntry.id, newContentReviewData);
    }
};

export const updateContentReviewStep = (
    steps: ApwContentReviewStep[],
    stepId: string,
    updater: (step: ApwContentReviewStep) => ApwContentReviewStep
): ApwContentReviewStep[] => {
    return steps.map(step => {
        if (step.id === stepId) {
            return {
                ...updater(step)
            };
        }
        return step;
    });
};