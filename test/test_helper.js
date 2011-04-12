function pretty_print(object) {
  var debug = "{ "
  for (var property in object) {
    if (typeof object[property] != 'function') {
      debug += property + " : " + object[property] + ", " 
    }
  }
  print(debug + "}")
}

function fireEvent(element,event){
  if (document.createEventObject){
    // dispatch for IE
    var evt = document.createEventObject();
    return element.fireEvent('on'+event,evt)
  }
  else{
    // dispatch for firefox + others
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent(event, true, true ); // event type,bubbling,cancelable
    return !element.dispatchEvent(evt);
  }
}

function is_instance_of(object, function_ref, message) {
  var def_msg = object + ' should be an instanceof ' + function_ref
  ok(object instanceof function_ref, $A(message,def_msg).join(" : "))
}

function is_undefined(object, message) {
  message = message || object + ' should be undefined'
  ok(typeof(object) == 'undefined', message)
}

function is_null(object, message) {
  message = message || object + ' should be null'
  ok(object === null, message)
}

// deepEqual fails when comparing Prototype Elements
function equal_element(actual, expected, deep) {
  var message = "Expected: " + expected.toString() + " but was " + actual.toString()
  equal(actual.toString(), expected.toString(), message)
  message = "Expected " + expected.attributes.length + " attributes but found " + actual.attributes.length
  equal(actual.attributes.length, expected.attributes.length, message)
  $A(expected.attributes).each(function(ex) {
    ac = actual.attributes[ex.name]
    message = "Expected attribute '" + ex.name + "' to be '" + ex.value + "' but found: '" + ac.value + "'"
    equal(ac.value, ex.value, message)
  })
  if (deep) {
    message = "Expected innerHTML: " + expected.innerHTML + "\n but was: " + actual.innerHTML
    equal(actual.innerHTML, expected.innerHTML, message)
  }
}

function equal_elements(actual, expected, deep) {
  var message = "Expected " + expected.length + " elements but found " + actual.length
  message = message + "\nExpected: " + expected.inspect() + "\nActual: " + actual.inspect()
  equal(actual.length, expected.length, message)
  $A(actual).zip(expected).each(function(pair) {
    equal_element(pair[0], pair[1], deep)
  })
}

// Reinitializes gold data for test configuration and comparisons.
function GoldData() {

  this.track_data = {
    dummy_visa_tracks : "%B4111111111111111^LAST/FIRST^15031019999900888000000?;4111111111111111=150310199999888?",
    visa : {
      track1 : "B4111111111111111^LAST/FIRST^15031019999900888000000",
      track2 : "4111111111111111=150310199999888",
      number : "4111111111111111",
      expiration : "1503",
      month: "03",
      year: "2015",
      first_name : "FIRST",
      last_name : "LAST",
      service_code : "101",
      format_code : "B"
    },
    dummy_mastercard_tracks : "%B5555555555554444^LAST/FIRST^14021019999900888000000?;5555555555554444=14021019999988800000?",
    mc : {
      track1 : "B5555555555554444^LAST/FIRST^14021019999900888000000",
      track2 : "5555555555554444=14021019999988800000",
      number : "5555555555554444",
      expiration : "1402",
      month: "02",
      year: "2014",
      first_name : "FIRST",
      last_name : "LAST",
      service_code : "101",
      format_code : "B"
    },
  }
  
  this.purchase_codes = [
    {
      id: 1,
      code: "ST",
      label: "Store Purchase",
      account_number: "4210.000",
      account_name: "Store Purchase",
      fee_types: [],
      account_type: "Income",
      debit_or_credit: "C",
      allow_detail: true,
    },
    {
      id: 2,
      code: "PR",
      label: "Personal Retreat",
      account_number: "4100.000",
      account_name: "Personal Retreat",
      fee_types: ["guaranteed_privacy", "lodging"],
      account_type: "Income",
      debit_or_credit: "C",
      allow_detail: true,
    },
  ]

  this.payment_codes = [
    {
      id: 3,
      code: "CA",
      label: "Cash",
      account_number: "1010.000",
      account_name: "Cash",
      fee_types: [],
      payment_type: "Cash",
      account_type: "Asset",
      debit_or_credit: "D",
      allow_detail: false,
    },
    {
      id: 4,
      code: "CVT",
      label: "Credit Voucher Payment",
      account_number: "2251.000",
      account_name: "Credit Vouchers",
      payment_type: "CreditVoucher",
      account_type: "Liability",
      debit_or_credit: "D",
      allow_detail: false,
    },
    {
      id: 5,
      code: "CH",
      label: "Check",
      account_number: "1900.000",
      account_name: "Undeposited Funds",
      payment_type: "Check",
      account_type: "Asset",
      debit_or_credit: "D",
      allow_detail: false,
    },
  ] 

  this.credit_codes = [
    {
      id: 6,
      code: "CVTC",
      label: "Issue Credit Voucher",
      account_number: "2251.000",
      account_name: "Credit Vouchers",
      payment_type: "CreditVoucher",
      account_type: "Liability",
      debit_or_credit: "C",
      allow_detail: false,
    },
    {
      id: 7,
      code: "GCTC",
      label: "Gift Certificate Credit",
      account_number: "2250.000",
      account_name: "Gift Certificates",
      payment_type: "GiftCertificate",
      account_type: "Liability",
      debit_or_credit: "C",
      allow_detail: false,
    },
  ]

  this.payment = { }

  this.ledger = [
    {
      id: 38,
      type: "Asset",
      account_number: "1010.000",
      account_name: "Cash",
      debit: null,
      credit: 8.0,
      detail: '',
      register_code: "CA",
      code_label: "Change",
      code_type: "change",
    },
    {
      id: 37,
      type: "Asset",
      account_number: "1010.000",
      account_name: "Cash",
      debit: 40.0,
      credit: null,
      detail: '',
      register_code: "CA",
      code_label: "Cash",
      code_type: "payment",
    },
    {
      id: 36,
      type: "Income",
      account_number: "4210.000",
      account_name: "Store Purchase",
      debit: null,
      credit: 32.0,
      detail: '',
      register_code: "ST",
      code_label: "Store Purchase",
      code_type: "purchase",
    },
  ]

  this.template = this.extract_register_template()
}
GoldData.prototype = {
  new_payment_register_config: function() {
    return {
      purchase_codes: this.purchase_codes,
      payment_codes: this.payment_codes,
      credit_codes: this.credit_codes,
      template: this.template,
    }
  },

  edit_payment_register_config: function() {
    return {
      purchase_codes: this.purchase_codes,
      payment_codes: this.payment_codes,
      credit_codes: this.credit_codes,
      payment: this.payment,
      ledger: this.ledger,
      template: this.template,
    }
  },

  extract_register_template: function() {
    if (typeof(GoldData.register_template) == 'undefined') {
      var register = $('register').remove()
      var wrapper = new Element('div').update(register)
      GoldData.register_template  = wrapper.innerHTML
    }
    return GoldData.register_template
  },
}
