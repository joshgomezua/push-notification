'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  Application = mongoose.model('Application'),
  UserDevice = mongoose.model('UserDevice'),
  AppUser = mongoose.model('AppUser'),
  Segment = mongoose.model('Segment'),
  appUserLib = require('../libs/appUser.server.lib'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller'));

/**
 * getAudiences
 */
exports.getAudiences = function(req, res) {
  appUserLib.getAppUsersBySegment(req.application, req.query.segmentId, req.query.offset, req.query.limit || 20)
  .then(function(result) {
    res.json(_.map(result, function(u) {
      return _.omit(u.toObject(), 'verifyDevice', 'verifyMethod', 'verifyToken'); // remove sensitive information
    }));
  })
  .catch(function(err) {
    console.log(err);
    res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  });
};

exports.getAudienceCounts = function(req, res) {
  var deviceIds = [];
  AppUser.find({ application: req.application._id }).select('userDevice')
  .then(function(userDevices) {
    deviceIds = _.map(userDevices, function(d) { return d.userDevice; });
    return Segment.find({ _id: { $in: req.body.segmentIds } }).populate('filter');
  })
  .then(function(segments) {
    var promises = _.map(segments, function(segment) {
      var match = segment ? JSON.parse(segment.filter.body) : {};
      return UserDevice.aggregate([
        {
          $match: _.extend({
            _id: { $in: deviceIds }
          }, match)
        }, {
          $group: {
            _id: segment._id,
            count: { $sum: 1 }
          }
        }
      ]).exec();
    });
    return Promise.all(promises);
  })
  .then(function(result) {
    var resp = {};
    _.each(result, function(agg) {
      resp[agg[0]._id] = agg[0].count;
    });
    res.json(resp);
  })
  .catch(function(err) {
    res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  });
};
