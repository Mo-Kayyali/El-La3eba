"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function main() {
    const dataDir = path.resolve(__dirname, '../../');
    const auditPath = path.join(dataDir, 'duplicate_players_audit.json');
    if (!fs.existsSync(auditPath)) {
        console.error('Audit file not found');
        return;
    }
    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    const pairs = auditData.duplicates || [];
    const filteredPairs = pairs.filter((pair) => pair.player1.nationality === pair.player2.nationality);
    const removedCount = pairs.length - filteredPairs.length;
    fs.writeFileSync(auditPath, JSON.stringify({
        summary: { totalSuspectedDuplicates: filteredPairs.length },
        duplicates: filteredPairs
    }, null, 2));
    console.log(`Removed ${removedCount} pairs with different nationalities.`);
    console.log(`Remaining suspected duplicates: ${filteredPairs.length}`);
}
main();
//# sourceMappingURL=filter_nationalities.js.map