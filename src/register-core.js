// This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html.

var Register = {
  version: '0.1.0',
}

//////////////////////
// Simple Inheritance
//////////////////////
Function.prototype.inherits = function(parent_function) { 
  this.prototype = new parent_function
  this.prototype.constructor = this
  this.prototype.parent = parent_function.prototype
  return this
} 

///////////////////
// Register.Core
///////////////////

// Methods available to all Register.<Object> instances.
Register.Core = function() {
}
Register.Core.prototype = {
  // Given a constructor method, maps an array of configuration data into an
  // array of constructor instances.
  initialize_array_of: function(element_function, config_array) {
    return $A(config_array).map(function(config) { return new element_function.prototype.constructor(config) } )
  },

  // Locate by an id string, in the DOM, or in passed element.  This method should be used
  // for locating required elements in the register's html template.
  // Throws Register.Exceptions.MissingElementException if not found unless loudly is set false.
  locate: function(selector, context, loudly) {
    var quietly = loudly === false ? true : false
    var element = (context ?
      context.down("#" + selector) :
      $(selector)
    )
    if (Object.is_null_or_undefined(element) && !quietly) {
      throw( new Register.Exceptions.MissingElementException(selector, context) ) 
    } else if (element) {
      return element 
    }
    return undefined 
  },
}

///////////////////////
// Register.Exceptions
//////////////////////
Register.Exceptions = {
  MissingElementException: function(selector, element) {
    this.name = "MissingElementException"
    this.message = "Unable to find " + selector + " in " + element
  },
}

/////////////////////
// Register.Instance
/////////////////////

// A Register.Instance is the primary handle for an active register.
//
// Expects to be passed a configuration Object with:
//
// * purchase_codes : Array of raw purchase Code data
// * payment_codes : Array of raw payment Code data
// * credit_codes : Array of raw credit Code data
// * ledger : Array of raw LedgerRow data
// * payment : Object of raw Payment data
// * template : String representing the register template XHTML
//
Register.Instance = function(config) {
  this.config = config || {}
  this.purchase_codes = this.initialize_array_of(Register.Code, this.config.purchase_codes)
  this.payment_codes = this.initialize_array_of(Register.Code, this.config.payment_codes)
  this.credit_codes = this.initialize_array_of(Register.Code, this.config.credit_codes)
  this.ledger = new Register.Ledger(this.config.ledger)
  this.payment = new Register.Payment(this.config.payment)
  this.ui = new Register.UI(this, this.config.template)
}
Register.Instance.inherits(Register.Core)
Object.extend(Register.Instance.prototype, {

})

/////////////////////
// Register.Code
/////////////////////

// A Register.Code represents one code that a user of the register would
// use to code a particular purchase, payment or credit line item.
Register.Code = function(config) {
  this.config = config || {}
}
Register.Code.inherits(Register.Core)

/////////////////////
// Register.Ledger
/////////////////////

// The Register.Ledger is the collection of all ledger entries which
// collectively will make up the accounting transaction being processed by this
// payment.
Register.Ledger = function(config) {
  this.config = config || {}
  this.rows = this.initialize_array_of(Register.LedgerRow, this.config.rows)
}
Register.Ledger.inherits(Register.Core)

/////////////////////
// Register.LedgerRow
/////////////////////

// A debit or credit associated with an account.
Register.LedgerRow = function(config) {
  this.config = config || {}
}
Register.LedgerRow.inherits(Register.Core)

/////////////////////
// Register.Payment
/////////////////////

// General information about the payment.
Register.Payment = function(config) {
  this.config = config || {}
}
Register.Payment.inherits(Register.Core)

/////////////////////
// Register.UI
/////////////////////

// Provides the HTML and events for user interaction with the register.
Register.UI = function(register, template) {
  this.register = register
  this.template_source = template || ''
  this.initialize()
}
Register.UI.inherits(Register.Core)
// Constants
Register.UI.LEDGER_ROW_TEMPLATE_ID = 'ledger-entry-row-template'
// Methods
Object.extend(Register.UI.prototype, {
  initialize: function() {
    var wrapper = new Element('div').update(this.template_source)
    this.register_template = wrapper.childElements().first()
    if (this.register_template) {
      this.ledger_row_template = this.locate(Register.UI.LEDGER_ROW_TEMPLATE_ID, this.register_template).remove()
      this.root = this.register_template.cloneNode(true)
    }
  },
})

/////////////////////////
// Object Utilities
/////////////////////////
Object.extend(Object, {
  is_null_or_undefined: function(object) {
    return object === null || typeof(object) == 'undefined'
  },
})
