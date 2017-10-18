'use strict';

const doc = require('dynamodb-doc');
const dynamo = new doc.DynamoDB();
var token = '';
var userData = null;
exports.handler = (event, context, callback) => {

    const done = (err, res) => callback(null, {
        statusCode: err ? (err.statusCode ? err.statusCode: '400') : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (event['detail-type'] == 'Scheduled Event') {
        // CloudWatch Eventsから実行されたらランキング更新
        updateRanking(null, function(){});
        return;
    }
    if (event.headers['x-user-token']) {
        token = event.headers['x-user-token'];
    }
    // デバッグ用にクエリパラメータでもtokenを与えられるようにする
    if (event.queryStringParameters && event.queryStringParameters.token) {
        token = event.queryStringParameters.token;
    }
    console.log(JSON.stringify(event));
    switch(event.path) {
        case '/signup':
            signup(event, done);
            break;
        case '/signin':
            checkAuth(event, done, signin);
            break;
        case '/user':
            checkAuth(event, done, user);
            break;
        case '/score':
            checkAuth(event, done, score);
            break;
        case '/ranking':
            ranking(event, done);
            break;
        case '/batch': // デバッグ用
            updateRanking(event, done);
            break;
        default:
            console.log('other path: ' + event.path);
            done(null, {error: 'not found'});
            break;
    }
};

function checkAuth(event, done, callback) {
    if (token == '') {
        done({statusCode: 401, message: 'Authentication error'}, {});
    }
    dynamo.getItem({
        TableName: 'Token',
        Key: {token:token},
    }, function(event, done, callback, err, data) {
        if (err || Object.keys(data).length == 0) {
            done({statusCode: 401, message: 'Authentication error'}, {});
        } else {
            dynamo.getItem({
                TableName: 'User',
                Key: {id: data.Item.user_id}
            },function(event, done, callback, err, data) {
                if (err) {
                    done(err, data);
                } else {
                    userData = data.Item;
                    callback(event, done);
                }
            }.bind(null, event, done, callback))
        }
    }.bind(null, event, done, callback));

}
function signup(event, done) {
    console.log('signup');
    token = getUniqueStr();

    dynamo.putItem(
        {
            TableName: 'Token',
            Item: {
                'token': token,
                'user_id': token, // いったんuser_idにtokenを入れておく。将来的には別の値にしたいな
            }
        }, function(done, err, data) {
            if (err) {
                done(err, data);
            } else {
                createUser(done)
            }
        }.bind(null, done)
    );
}
function createUser(done) {
    dynamo.putItem(
        {
            TableName: 'User',
            Item: {
                'id': token,
                'name': createName(),
                'highscore': 0,
                'rank': 0,
            }
        }, function(done, err, data) {
            if (err) {
                done(err, data);
            } else {
                done(null, {tokne: token});
            }
        }.bind(null, done)
    );
    done(null, {token: token});
}


function signin(event, done) {
    console.log('signin');
    done(null, {status:'ok'});
}

function score(event, done) {
    var score = event.queryStringParameters.score;
    if (!score) done({statusCode:401, message: 'ng'});
    if (score > userData.highscore) {
    //if (true || score > userData.highscore) { // 負荷試験用に毎回更新をかける
        console.log('update highscore!!');
        dynamo.updateItem({
            TableName: 'User',
            Key: {"id": userData.id},
            UpdateExpression: "set #key = :value",
            "ExpressionAttributeNames": {"#key": "highscore"},
            "ExpressionAttributeValues": {":value": score}
        },done);
    } else {
        done(null, {});
    }
}

function ranking(event, done) {
    console.log('ranking');
    dynamo.scan({TableName: 'Ranking', Limit: 100}, function(done, err, data) {
        if (err) {
            done(err, data);
        } else {
            data.Items.sort(function(a,b){
                if (a.rank < b.rank) return -1;
                if (a.rank > b.rank) return 1;
                return 0;
            });
            done(null, {rankings: data.Items});
        }
    }.bind(null, done));
}

function user(event, done) {
    console.log('user');
    done(null, userData);
}

function updateRanking(event, done) {
    console.log('Scheduled Event!!');
    dynamo.scan({
        'TableName': 'User',
    }, function(done, err, data) {
        if (err) {
            done(err, data)
        } else {
            var userList = data.Items;
            userList.sort(function(a,b){
                if (a.highscore < b.highscore) return 1;
                if (a.highscore > b.highscore) return -1;
                return 0;
            });
            var result = [];
            for (var i = 0; i < userList.length; i++) {
                var rank = i + 1;
                if (userList[i].highscore > 0) {
                    var user = {};
                    Object.assign(user, userList[i]);
                    result[i] = user;
                    result[i].rank = rank;
                    if (userList[i].rank != rank) {
                        userList[i].newRank = rank;
                        updateUserRank(userList[i].id, rank);
                    }

                }
            }

            for (i = 0; i < Math.min(100, result.length); i++) {
                dynamo.putItem({
                    TableName: 'Ranking',
                    Item: result[i]
                }, done);
            }

            for (i = 0; i < userList.length; i++) {
                console.log(userList[i]);
            }

            done(null, result);
        }
    }.bind(null, done));
}

function updateUserRank(userId, rank) {
    console.log('update:' + userId + '->' + rank);
    dynamo.updateItem({
        TableName: 'User',
        Key: {"id": userId},
        UpdateExpression: "set #key = :value",
        "ExpressionAttributeNames": {"#key": "rank"},
        "ExpressionAttributeValues": {":value": rank}
    },function(){});

}

function getUniqueStr(myStrong){
    var strong = 1000;
    if (myStrong) strong = myStrong;
    return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16)
}

function createName() {
    var nameList = [
        'masahiro',
        'takuya',
        'goro',
        'tsuyoshi',
        'shingo',
        ];
    return nameList[Math.floor(Math.random()*nameList.length)]
}
