export interface AlConditionalSubject {
    getPropertyValue( property:string, ns:string ):any;
}

export class AlQueryEvaluator {

    constructor( public query?:any ) {
    }

    public test( target:AlConditionalSubject, query?:any ):boolean {
        if ( query ) {
            this.query = query;
        }
        return this.dispatchOperator( this.query, target );
    }

    protected dispatchOperator( op:any, target:AlConditionalSubject ):boolean {
        const operatorKeys = Object.keys( op );
        this.assert( op, operatorKeys.length === 1, "an operator descriptor should have a single key." );
        const operatorKey = operatorKeys[0];
        const operatorValue = op[operatorKey];
        switch( operatorKey ) {
            case "and" :
                return this.evaluateAnd( operatorValue, target );
            case "or" :
                return this.evaluateOr( operatorValue, target );
            case "=" :
                return this.evaluateEquals( operatorValue, target );
            case "!=" :
                return this.evaluateNotEquals( operatorValue, target );
            case "in":
                return this.evaluateIn( operatorValue, target );
            case "not" :
                return this.evaluateNot( operatorValue, target );
            case "contains_all" :
                return this.evaluateContainsAll( operatorValue, target );
            case "contains_any" :
                return this.evaluateContainsAny( operatorValue, target );
            default :
                throw new Error(`Cannot evaluate unknown operator '${operatorKey}'` );
        }
    }

    protected evaluateAnd( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length > 0, "`and` descriptor should consist of an array of non-zero length" );
        let result = true;
        for ( let i = 0; i < op.length; i++ ) {
            result = result && this.dispatchOperator( op[i], target );
        }
        return result;
    }

    protected evaluateOr( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length > 0, "`and` descriptor should consist of an array of non-zero length" );
        let result = false;
        for ( let i = 0; i < op.length; i++ ) {
            result = result || this.dispatchOperator( op[i], target );
        }
        return result;
    }

    protected evaluateEquals( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`!=` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = target.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue === testValue;
    }

    protected evaluateNotEquals( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`=` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = target.getPropertyValue( property.id, property.ns );
        let testValue = op[1];

        return actualValue !== testValue;
    }

    protected evaluateIn( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`in` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValue = target.getPropertyValue( property.id, property.ns );
        let testValues = op[1];
        this.assert( testValues, testValues.hasOwnProperty("length"), "`in` values clause must be an array" );
        return testValues.includes( actualValue );
    }

    protected evaluateNot( op:any, target:AlConditionalSubject ):boolean {
        return ! this.dispatchOperator( op, target );
    }

    protected evaluateContainsAny( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`in` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValues = target.getPropertyValue( property.id, property.ns );
        this.assert( actualValues, typeof( actualValues ) === 'object', "`contains_any` operator must reference a property that is an object or an array" );
        let testValues = op[1];
        this.assert( testValues, testValues.hasOwnProperty("length"), "`in` values clause must be an array" );
        return testValues.reduce( ( alpha:boolean, value:any ) => {
            if ( actualValues instanceof Array ) {
                return alpha || actualValues.includes( value );
            } else {
                return alpha || ( actualValues.hasOwnProperty( value ) && !! actualValues[value] );
            }
        }, false );
    }

    protected evaluateContainsAll( op:any, target:AlConditionalSubject ):boolean {
        this.assert( op, op.hasOwnProperty("length") && op.length === 2, "`in` descriptor should have two elements" );
        let property = this.normalizeProperty( op[0] );
        let actualValues = target.getPropertyValue( property.id, property.ns );
        this.assert( actualValues, typeof( actualValues ) === 'object', "`contains_all` operator must reference a property that is an object or an array" );
        let testValues = op[1];
        this.assert( testValues, testValues.hasOwnProperty("length"), "`in` values clause must be an array" );
        return testValues.reduce( ( alpha:boolean, value:any ) => {
            if ( actualValues instanceof Array ) {
                return alpha && actualValues.includes( value );
            } else {
                return alpha && ( actualValues.hasOwnProperty( value ) && !! actualValues[value] );
            }
        }, true );
    }

    protected normalizeProperty( descriptor:any ):{ns:string,id:string} {
        this.assert( descriptor, descriptor.hasOwnProperty("source"), "property reference must include a `source` property" );
        let propertyRef = descriptor.source;
        let propertyName;
        let propertyNs = "default";
        if ( typeof( propertyRef ) === 'object' && propertyRef.hasOwnProperty("ns") && propertyRef.hasOwnProperty("id") ) {
            propertyNs = propertyRef.ns;
            propertyName = propertyRef.id;
        } else if ( typeof( propertyRef ) === 'string' ) {
            propertyName = propertyRef;
        } else {
            throw new Error(`Invalid property reference [${JSON.stringify(descriptor[0].source)}] in condition descriptor` );
        }
        return { ns: propertyNs, id: propertyName };
    }

    protected assert( target:any, value:boolean, message:string ) {
        if ( ! value ) {
            console.warn("Invalid conditional element", target );
            throw new Error( `Failed to interpret condition descriptor: ${message}` );
        }
    }
}

