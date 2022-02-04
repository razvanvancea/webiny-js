export interface CreatedBy {
    /**
     * ID if the user.
     */
    id: string;
    /**
     * Full name of the user.
     */
    displayName: string;
    /**
     * Type of the user (admin, user)
     */
    type: string;
}

export enum ApwWorkflowScopeTypes {
    DEFAULT = "default",
    PB = "pb",
    CMS = "cms"
}

export enum ApwContentReviewStepStatus {
    DONE = "done",
    ACTIVE = "active",
    INACTIVE = "inactive"
}

export enum ApwWorkflowApplications {
    PB = "pageBuilder",
    CMS = "cms"
}

export enum ApwContentTypes {
    PAGE = "page",
    CMS_ENTRY = "cms_entry"
}

export interface ApwWorkflowScope {
    type: ApwWorkflowScopeTypes;
    data: {
        categories?: string[];
        pages?: string[];
        models?: string[];
        entries?: string[];
    };
}

export enum ApwWorkflowStepTypes {
    MANDATORY_BLOCKING = "mandatoryBlocking",
    MANDATORY_NON_BLOCKING = "mandatoryNonBlocking",
    NON_MANDATORY = "notMandatory"
}

export enum ApwContentReviewStatus {
    UNDER_REVIEW = "underReview",
    READY_TO_BE_PUBLISHED = "readyToBePublished",
    PUBLISHED = "published"
}

export interface ApwWorkflowStep {
    title: string;
    type: ApwWorkflowStepTypes;
    reviewers: string[];
}

export interface ApwContentReviewStep extends ApwWorkflowStep {
    id: string;
    status: ApwContentReviewStepStatus;
    pendingChangeRequests: number;
    signOffProvidedOn: string;
}

interface BaseFields {
    id: string;
    createdOn: string;
    savedOn: string;
    createdBy: CreatedBy;
}

export interface ApwReviewer extends BaseFields {
    identityId: string;
    displayName: string;
    type: string;
}

export interface PbCategory {
    slug: string;
    name: string;
}

export interface PbPage {
    id: string;
    title: string;
}

export interface ApwComment extends BaseFields {
    body: Record<string, any>;
    changeRequest: string;
}

export interface ApwContentReviewContent {
    id: string;
    type: ApwContentTypes;
    workflowId: string;
    title: string;
    version: number;
    settings: {
        modelId?: string;
    };
}

export interface ApwContentReview extends BaseFields {
    status: ApwContentReviewStatus;
    content: ApwContentReviewContent;
    steps: Array<ApwContentReviewStep>;
}

export interface ApwContentReviewListItem extends BaseFields {
    steps: [ApwContentReviewStep];
    content: ApwContentReviewContent;
    status: ApwContentReviewStatus;
    activeStep: ApwContentReviewStep;
    totalComments: number;
    latestCommentId: string;
    reviewers: [string];
}