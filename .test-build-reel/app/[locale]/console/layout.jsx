"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleLayout;
const ConsoleShell_1 = __importDefault(require("@/components/ConsoleShell"));
/**
 * Console plateforme (extension v1.2) : le shell porte la garde
 * d'accès Admin / Super Admin et la navigation console.
 */
function ConsoleLayout({ children }) {
    return <ConsoleShell_1.default>{children}</ConsoleShell_1.default>;
}
