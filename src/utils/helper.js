// ================================================
// FILE: src/utils/helper.js
// ================================================
const { getDB } = require('../database');

const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
        // Always get the current active DB instance
        getDB().run(query, params, function(err) {
            if(err) {
                reject(err);
            } else {
                resolve(this);
            }
        })
    })
}

const all = (query, params = []) => {
    return new Promise((resolve, reject) => {
        getDB().all(query, params, (err, rows) => {
            if(err) {
                reject(err);
            } else {
                resolve(rows);
            }
        })
    })
}

const get = (query, params = []) => {
    return new Promise((resolve, reject) => {
        getDB().get(query, params, (err, row) => {
            if(err) {
                reject(err);
            } else {
                resolve(row);
            }
        })
    })
}

module.exports = { run, all, get }