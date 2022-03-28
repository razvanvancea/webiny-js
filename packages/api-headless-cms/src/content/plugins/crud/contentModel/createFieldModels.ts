import { CmsModelField, CmsModel, CmsModelUpdateInput } from "~/types";
import { ContentModelFieldModel } from "./models";
import WebinyError from "@webiny/error";

export const createFieldModels = async (
    model: CmsModel,
    input: CmsModelUpdateInput
): Promise<CmsModelField[]> => {
    const aliases: string[] = [];

    const fields: CmsModelField[] = [];
    for (const field of input.fields) {
        const fieldData = new ContentModelFieldModel().populate(field);
        await fieldData.validate();
        const alias = (field.alias || "").trim();
        if (!!alias) {
            if (aliases.includes(alias)) {
                throw new WebinyError(
                    `Field alias already exists in current model.`,
                    "DUPLICATE_FIELD_ALIAS",
                    {
                        model: model.modelId,
                        id: field.id,
                        fieldId: field.fieldId,
                        alias: alias
                    }
                );
            }
            aliases.push(alias);
        }
        fields.push(await fieldData.toJSON());
    }
    return fields;
};
