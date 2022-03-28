import { CmsModel } from "~/types";
import semver from "semver";

const targetVersion = "5.26.0";
/**
 * Method used to assign model.fields aliases if model version was stored with older than the required version.
 * If alias is not defined, use the fieldId from the field.
 * In case of null or string it is used - this should not happen because if model was stored with the targetVersion
 * there should be alias in the fields (either string or null).
 */
export const assignModelFieldAliases = (models: CmsModel[]): CmsModel[] => {
    return models.map(model => {
        if (semver.gte(model.webinyVersion, targetVersion) === true) {
            return model;
        }
        return {
            ...model,
            fields: model.fields.map(field => {
                return {
                    ...field,
                    alias: field.alias === undefined ? field.fieldId : field.alias
                };
            })
        };
    });
};
