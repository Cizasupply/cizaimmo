"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const LegalPage_1 = __importDefault(require("@/components/LegalPage"));
function Page({ params }) {
    return <LegalPage_1.default params={params} page="terms" sections={6}/>;
}
