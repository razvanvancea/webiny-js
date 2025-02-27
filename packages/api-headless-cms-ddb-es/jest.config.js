const dynamoDbPreset = require("jest-dynalite/jest-preset");
const base = require("../../jest.config.base");

const prefix = process.env.ELASTIC_SEARCH_INDEX_PREFIX || "";
process.env.ELASTIC_SEARCH_INDEX_PREFIX = `${prefix}api-headless-cms-`;

module.exports = {
    ...base({ path: __dirname }, [dynamoDbPreset])
};
