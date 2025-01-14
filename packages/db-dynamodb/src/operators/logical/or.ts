import {
    Operator,
    ProcessStatementArgsParam,
    ProcessStatementCallable,
    ProcessStatementQueryParam
} from "~/types";

const processQuery = (
    query: ProcessStatementQueryParam,
    orArgs: ProcessStatementArgsParam,
    processStatement: ProcessStatementCallable
) => {
    const args: ProcessStatementArgsParam = {
        expression: "",
        attributeNames: {},
        attributeValues: {}
    };

    processStatement({ args, query });

    Object.assign(orArgs.attributeNames, args.attributeNames);
    Object.assign(orArgs.attributeValues, args.attributeValues);

    if (orArgs.expression === "") {
        orArgs.expression = args.expression;
    } else {
        orArgs.expression += " or " + args.expression;
    }
};

const or: Operator = {
    canProcess: ({ key }) => {
        return key === "$or";
    },
    process: ({ value, args, processStatement }) => {
        const orArgs: ProcessStatementArgsParam = {
            expression: "",
            attributeNames: {},
            attributeValues: {}
        };

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                processQuery(value[i], orArgs, processStatement);
            }
        } else {
            for (const [orKey, orValue] of Object.entries(value)) {
                processQuery({ [orKey]: orValue }, orArgs, processStatement);
            }
        }

        args.expression += "(" + orArgs.expression + ")";
        Object.assign(args.attributeNames, orArgs.attributeNames);
        Object.assign(args.attributeValues, orArgs.attributeValues);
    }
};

export default or;
