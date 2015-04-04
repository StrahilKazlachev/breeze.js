(function (testFns) {
  var breeze = testFns.breeze;
  var core = breeze.core;

  var EntityQuery = breeze.EntityQuery;
  var MetadataStore = breeze.MetadataStore;
  var EntityManager = breeze.EntityManager;
  var EntityKey = breeze.EntityKey;
  var DataType = breeze.DataType;
  var FilterQueryOp = breeze.FilterQueryOp;
  var Predicate = breeze.Predicate;
  var QueryOptions = breeze.QueryOptions;
  var FetchStrategy = breeze.FetchStrategy;
  var MergeStrategy = breeze.MergeStrategy;

  var newEm = testFns.newEm;

  module("query - datatype", {
    beforeEach: function (assert) {
      testFns.setup(assert);
    },
    afterEach: function (assert) {

    }
  });

  /*********************************************************
   * local cache query for all Suppliers in region 'Papa'
   *********************************************************/
  test("local cache query for all Suppliers in region 'Papa'", 2, function (assert) {
    var done = assert.async();

    var query = new breeze.EntityQuery("Suppliers");
    var em = newEm(); // creates a new EntityManager configured with metadata
    
    em.executeQuery(query)
        .then(querySucceeded)
        .fail(testFns.handleFail)
        .fin(done);

    function querySucceeded(data) {
      var count = data.results.length;
      ok(count > 0, "supplier query returned " + count);

      var predicate = breeze.Predicate.create(testFns.supplierKeyName, '==', 0)
          .or('companyName', '==', 'Papa');

      var localQuery = breeze.EntityQuery
          .from('Suppliers')
          .where(predicate)
          .toType('Supplier');

      var suppliers = em.executeQueryLocally(localQuery);
      // Defect #2486 Fails with "Invalid ISO8601 duration 'Papa'"
      equal(suppliers.length, 0, "local query should succeed with no results");
    }
  });

  testFns.skipIf("odata,mongo", "has not yet implemented server side interception").
  test("Insure that this is Not a duration query even without type mapping", function (assert) {
    var done = assert.async();

    var em = newEm();
    var q = EntityQuery.from("AltCustomers").where('companyName', '==', 'Papa');
    
    em.executeQuery(q).then(function (data) {
      ok(true);
      ok(data.results.length === 0);
    }).fail(function (error) {
      ok(false, error.message);
    }).fin(done);
  });

  testFns.skipIf("mongo,odata,sequelize,hibernate", "is N/A for this EF specific test").
  test("Query Involving Multiple Entities on Server", function (assert) {
      var done = assert.async();

      var em = newEm();
      var q = EntityQuery.from("QueryInvolvingMultipleEntities");

      
      em.executeQuery(q).then(function (data) {
        ok(true);
      }).fail(function (error) {
        ok(false, error.message);
      }).fin(done);
    });

  test("byte w/save", function (assert) {
    var done = assert.async();
    var em = newEm();
    var dt = new Date();
    dt.setUTCMilliseconds(100);
    var c1 = em.createEntity("Comment", { createdOn: dt, seqNum: 11, comment1: "now is the time for" });
    var c1 = em.createEntity("Comment", { createdOn: dt, seqNum: '7', comment1: "foo" });
    
    em.saveChanges().then(function (sr) {
      var comments = sr.entities;
      ok(comments.length === 2, "should have saved 2 comments");
      var em2 = newEm();
      var pred2 = Predicate.create("createdOn", "==", dt).and("seqNum", "==", 11);
      var q2 = EntityQuery.from("Comments").where(pred2);
      return em2.executeQuery(q2);
    }).then(function (data) {
      var comments2 = data.results;
      ok(comments2.length === 1, "should have returned 1 comment - seqNum=11");
      var em3 = newEm();
      var pred3 = Predicate.create("createdOn", "==", dt).and("seqNum", "==", '7');
      var q3 = EntityQuery.from("Comments").where(pred3);
      return em3.executeQuery(q3);
    }).then(function (data) {
      var comments3 = data.results;
      ok(comments3.length === 1, "should have returned 1 comment - seqNum='7'");
    }).fail(testFns.handleFail).fin(done);
  });

  test("dateTime w/save", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Users").take(1);
    
    var modDate;
    em.executeQuery(query).then(function (data) {
      var user = data.results[0];
      var oldDate = user.getProperty("modifiedDate");
      modDate = new Date(oldDate.getTime() + 10000);
      user.setProperty("modifiedDate", modDate);
      return em.saveChanges();
    }).then(function (sr) {
      var r = sr.entities;
      ok(r.length === 1, "1 rec should have been saved");
      var user2 = r[0];
      var q = EntityQuery.fromEntities(user2);
      var em2 = newEm();
      return em2.executeQuery(q);
    }).then(function (data) {
      var user3 = data.results[0]
      var modDate3 = user3.getProperty("modifiedDate");
      ok(modDate.getTime() == modDate3.getTime(), "dates should be the same - dateTime");

    }).fail(testFns.handleFail).fin(done);
  });

  testFns.skipIf("mongo,sequelize,hibernate,odata", "does not have these datatypes").
  test("dateTimeOffset & dateTime2 w/save", function(assert) {
      var done = assert.async();
      var em = newEm();
      var query = new EntityQuery("UnusualDates").take(10);
      var tlimitType = em.metadataStore.getEntityType("UnusualDate");
      var dt1 = new Date(2001, 1, 1, 1, 1, 1);
      var dt2 = new Date(2002, 2, 2, 2, 2, 2);
      var tlimit = tlimitType.createEntity();
      tlimit.setProperty("creationDate", dt1);
      tlimit.setProperty("modificationDate", dt2);
      em.addEntity(tlimit);
      
      em.saveChanges().then(function (sr) {
        var r = sr.entities;
        ok(r.length === 1, "1 rec should have been saved");
        var tlimit2 = r[0];
        var q = EntityQuery.fromEntities(tlimit2);
        return em.executeQuery(q);
      }).then(function (data) {
        var r = data.results;
        var tlimit3 = r[0];
        var dt1a = tlimit3.getProperty("creationDate");
        var dt2a = tlimit3.getProperty("modificationDate");
        ok(dt1a.getTime() == dt1.getTime(), "creation dates should be the same - dateTimeOffset");
        ok(dt2a.getTime() === dt2.getTime(), "mod dates should be the same - dateTime2");
      }).fail(testFns.handleFail).fin(done);

    });

  testFns.skipIf("mongo,sequelize,hibernate,odata", "does not have these datatypes").
  test("where dateTimeOffset & dateTime2", function(assert) {
    var done = assert.async();
    var em = newEm();
    var dt1 = new Date(1950, 1, 1, 1, 1, 1);
    var p1 = Predicate.create("creationDate", ">", dt1).or("modificationDate", ">", dt1);
    var query = EntityQuery.from("UnusualDates").where(p1);
    
    em.executeQuery(query).then(function (data) {
      var r = data.results;
      ok(r.length > 0, "should be some results");
    }).fail(testFns.handleFail).fin(done);

  });

  testFns.skipIf("mongo,sequelize,hibernate,odata", "does not have these datatypes").
  test("export/import dateTimeOffset with nulls", function(assert) {
    var done = assert.async();
    var em = newEm();

    var p1 = Predicate.create("modificationDate2", "==", null);
    var query = EntityQuery.from("UnusualDates").where(p1).take(2);
    
    em.executeQuery(query).then(function (data) {
      var r = data.results;
      ok(r.length == 2, "should be some results");
      var exportedEntities = em.exportEntities();
      var em2 = newEm();
      em2.importEntities(exportedEntities);
      var tls = em2.getEntities("UnusualDate");
      var isOk = tls.every(function (tl) {
        var modDt = tl.getProperty("modificationDate2");
        return modDt == null;
      });
      ok(isOk, "import of exported null dateTimeOffsets should succeed");
    }).fail(testFns.handleFail).fin(done);

  });

  testFns.skipIf("mongo,sequelize,hibernate", "does not have this datatype").
  test("time w/save", function (assert) {
    var done = assert.async();
    var newMs = MetadataStore.importMetadata(testFns.metadataStore.exportMetadata());
    var tlimitType = newMs.getEntityType("TimeLimit");
    core.arrayRemoveItem(tlimitType.dataProperties, function (dp) {
      return dp.dataType === DataType.Undefined;
    });
    var em = newEm(newMs);

    var query = new EntityQuery("TimeLimits").take(10);
    
    var tlimit, tlimit2;
    var duration = "PT7H17M40S";
    var sDuration = core.durationToSeconds(duration);
    var zeroTime;
    em.executeQuery(query).then(function (data) {
      var results = data.results;
      var maxTime = results[0].getProperty("maxTime");
      ok(maxTime, "maxTime should be defined");
      var tlimitType = em.metadataStore.getEntityType("TimeLimit");
      tlimit = tlimitType.createEntity();
      tlimit.setProperty("maxTime", duration);
      em.addEntity(tlimit);
      // check to insure that the default TimeSpan of 0 is used.
      tlimit2 = tlimitType.createEntity();
      tlimit2.setProperty("minTime", "PT20H20M20S");
      zeroTime = tlimit2.getProperty("maxTime");
      em.addEntity(tlimit2);
      return em.saveChanges();
    }).then(function (sr) {
      var ents = sr.entities;
      ok(ents.length === 2);
      var maxTime = tlimit.getProperty("maxTime");
      var sMaxTime = core.durationToSeconds(maxTime);
      ok(sMaxTime === sDuration, "maxTime should = " + sDuration);
      zeroTime = tlimit2.getProperty("maxTime");
      var q2 = EntityQuery.fromEntities([tlimit, tlimit2]).orderBy("minTime");
      var em2 = newEm();
      return em2.executeQuery(q2);
    }).then(function (data2) {
      var r = data2.results;
      ok(r.length === 2, "should have only returned 2 recs");
      var tl1 = r[0];
      var tl2 = r[1];
      var maxTime = tl1.getProperty("maxTime");
      var sMaxTime = core.durationToSeconds(maxTime);
      ok(sMaxTime === sDuration, "maxTime should = " + duration);
      var minTime = tlimit.getProperty("minTime");
      ok(minTime == null, "minTime should be null or undefined");
      var zt = tl2.getProperty("maxTime");
    }).fail(testFns.handleFail).fin(done);

  });

  testFns.skipIf("mongo,sequelize,hibernate", "does not have this datatype").
  test("time 2",  function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("TimeLimits").where("maxTime", ">", "PT4H").take(10);
    var fourHrs = core.durationToSeconds("PT4H");
    

    em.executeQuery(query).then(function (data) {
      var results = data.results;
      results.forEach(function (tlimit) {
        var maxTime = tlimit.getProperty("maxTime");
        var maxSecs = core.durationToSeconds(maxTime);
        ok(maxSecs > fourHrs, "maxTime should be greater than 4 hours - " + maxSecs + " > " + fourHrs);
      });
    }).fail(testFns.handleFail).fin(done);
  });

  testFns.skipIf("mongo,sequelize,hibernate", "does not have this datatype").
  test("time not null", function(assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("TimeLimits").where("minTime", "!=", null).take(10);
    

    em.executeQuery(query).then(function (data) {
      var results = data.results;
      ok(results.length > 0, "should be more than 0 recs with a null minTime");
      results.forEach(function (tlimit) {
        var minTime = tlimit.getProperty("minTime");
        ok(minTime, "minTime should not be null");

      });
    }).fail(testFns.handleFail).fin(done);
  });

  testFns.skipIf("mongo,sequelize,hibernate", "does not have this datatype").
  test("bad time", function() {
    
    var em = newEm();
    var tlimitType = em.metadataStore.getEntityType("TimeLimit");
    var tlimit = tlimitType.createEntity();
    em.attachEntity(tlimit);

    tlimit.setProperty("maxTime", "3:15");
    var valErrs = tlimit.entityAspect.getValidationErrors();
    ok(valErrs[0].errorMessage.indexOf("maxTime") > 0, "error message should mention maxTime");

    tlimit.setProperty("maxTime", "PT4M");
    valErrs = tlimit.entityAspect.getValidationErrors();
    ok(valErrs.length == 0, "should be no more errors");
  });

  testFns.skipIf("mongo,sequelize,hibernate", "does not have this datatype").
  test("timestamp w/save", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Roles").take(10);
    
    var role;
    em.executeQuery(query).then(function (data) {
      var results = data.results;
      var roleType = em.metadataStore.getEntityType("Role");
      role = roleType.createEntity();
      role.setProperty("name", "test1");
      role.setProperty("description", "descr 1");
      em.addEntity(role);

      return em.saveChanges();
    }).then(function (sr) {
      var ents = sr.entities;
      ok(ents.length === 1);
      var ts = role.getProperty("ts");
      ok(ts, "ts should not be empty now");
    }).fail(testFns.handleFail).fin(done);

  });

  testFns.skipIf("mongo,sequelize,hibernate,odata", "does not have enum support").
  test("enums w/save", function(assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Roles").where("roleType", "==", 'Restricted');
    var roleType = em.metadataStore.getEntityType("Role");
    
    var role;
    em.executeQuery(query).then(function (data) {
      var results = data.results;
      ok(results.length > 1, "more than one entity should have been queried");
      role = roleType.createEntity();
      role.setProperty("name", "test1");
      role.setProperty("description", "descr 1");
      role.setProperty("roleType", 'Standard');
      em.addEntity(role);
      return em.saveChanges();
    }).then(function (sr) {
      var ents = sr.entities;
      ok(ents.length === 1, "only one entity should have been saved");
      role = ents[0];
      var rt = role.getProperty("roleType");
      ok(rt === 'Standard', "roleType should = 'Standard'");
      var q = EntityQuery.fromEntities(ents);
      var em2 = newEm();
      return em2.executeQuery(q);
    }).then(function (data2) {
      var r = data2.results;
      ok(r.length === 1, "only one entity should have been queried");
      role = r[0];
      var rt = role.getProperty("roleType");
      ok(rt === 'Standard', "roleType should = 'Standard'");
    }).fail(testFns.handleFail).fin(done);

  });

  testFns.skipIf("mongo,sequelize,hibernate,odata", "does not have enum support").
  test("enums null - w/save", function(assert) {
    var done = assert.async();
    var em = newEm();
    var roleType = em.metadataStore.getEntityType("Role");
    var role = roleType.createEntity();
    role.setProperty("name", "test1");
    role.setProperty("description", "descr 1");
    role.setProperty("roleType", null);
    em.addEntity(role);
    
    em.saveChanges().then(function (sr) {
      var ents = sr.entities;
      ok(ents.length === 1);
      role = ents[0];
      var rt = role.getProperty("roleType");
      ok(rt == null, "roleType should be null");
      var q = EntityQuery.fromEntities(ents);
      q = q.where("roleType", "==", null);
      var em2 = newEm();
      return em2.executeQuery(q);
    }).then(function (data) {
      var r = data.results;
      ok(r.length === 1, "only one entity should have been queried");
      role = r[0];
      var rt = role.getProperty("roleType");
      ok(rt == null, "roleType should = null");
    }).fail(testFns.handleFail).fin(done);
  });

  test("nullable int", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Customers")
        .where("rowVersion", "==", 1)
        .take(10);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length > 0, "should have Alfreds Orders.");
    }).fail(testFns.handleFail).fin(done);
  });

  test("nullable int == null", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Customers")
        .where("rowVersion", "==", null)
        .take(10);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length > 0, "should have Alfreds Orders.");
    }).fail(testFns.handleFail).fin(done);
  });


  test("nullable date", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Orders")
        .where("orderDate", ">", new Date(1998, 1, 1))
        .take(10);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length > 0);
    }).fail(testFns.handleFail).fin(done);
  });

  test("nullable date == null", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Orders")
        .where("shippedDate", "==", null)
        .take(10);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length > 0);
    }).fail(testFns.handleFail).fin(done);
  });

  // we don't have a nullable book in NorthwindIB
  test("bool", function (assert) {
    var done = assert.async();
    var em = newEm();
    var discPropName = (testFns.DEBUG_MONGO || testFns.DEBUG_SEQUELIZE) ? "discontinued" : "isDiscontinued";
    var query = new EntityQuery("Products")
        .where(discPropName, "==", true)
        .take(10);
    
    em.executeQuery(query).then(function (data) {
      var products = data.results;
      ok(products.length > 0);
      ok(products.every(function (p) {
        return p.getProperty(discPropName) === true;
      }));
    }).fail(testFns.handleFail).fin(done);
  });

  test("nonnullable bool == null", function (assert) {
    var done = assert.async();
    var em = newEm();
    var discPropName = (testFns.DEBUG_MONGO || testFns.DEBUG_SEQUELIZE) ? "discontinued" : "isDiscontinued";
    var query = new EntityQuery("Products")
        .where(discPropName, "==", null)
        .take(30);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length === 0, "should not return any data");
    }).fail(testFns.handleFail).fin(done);
  });

  test("nullable guid", function (assert) {
    var done = assert.async();
    // ID of the Northwind "Alfreds Futterkiste" customer
    var alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    var em = newEm();
    var query = new EntityQuery("Orders")
        .where("customerID", "==", alfredsID);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length > 0, "should have Alfreds Orders.");
    }).fail(testFns.handleFail).fin(done);
  });

  test("nullable guid == null", function (assert) {
    var done = assert.async();
    var em = newEm();
    var query = new EntityQuery("Orders")
        .where("customerID", "==", null)
        .take(10);
    
    em.executeQuery(query).then(function (data) {
      ok(data.results.length > 0, "should have Alfreds Orders.");
    }).fail(testFns.handleFail).fin(done);
  });

  test("string equals null", function (assert) {
    var done = assert.async();
    var em = newEm();

    var query = new EntityQuery()
        .from("Customers")
        .where("region", FilterQueryOp.Equals, null)
        .take(20);

    var queryUrl = query._toUri(em);
    
    em.executeQuery(query, function (data) {
      var customers = data.results;
      ok(customers.length > 0);
      customers.forEach(function (customer) {
        var region = customer.getProperty("region");
        ok(region == null, "region should be either null or undefined");
      });
    }).fail(testFns.handleFail).fin(done);
  });

  test("string not equals null", function (assert) {
    var done = assert.async();
    var em = newEm();

    var query = new EntityQuery()
        .from("Customers")
        .where("region", FilterQueryOp.NotEquals, null)
        .take(10);

    var queryUrl = query._toUri(em);
    
    em.executeQuery(query, function (data) {
      var customers = data.results;
      ok(customers.length > 0);
      customers.forEach(function (customer) {
        var region = customer.getProperty("region");
        ok(region != null, "region should not be either null or undefined");
      });

    }).fail(testFns.handleFail).fin(done);
  });

})(breezeTestFns);