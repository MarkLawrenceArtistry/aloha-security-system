const { db } = require('../database');

// converted db.run
const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if(err) {
                reject(err);
            } else {
                resolve(this);
            }
        })
    })
}

// converted db.all
const all = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if(err) {
                reject(err);
            } else {
                resolve(rows);
            }
        })
    })
}

// converted db.get
const get = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if(err) {
                reject(err);
            } else {
                resolve(row);
            }
        })
    })
}

module.exports = { run, all, get }