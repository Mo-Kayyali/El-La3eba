"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalizeWords = capitalizeWords;
function capitalizeWords(str) {
    if (!str)
        return str;
    return str.split(' ').map(word => {
        if (word.length === 0)
            return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}
//# sourceMappingURL=string.util.js.map