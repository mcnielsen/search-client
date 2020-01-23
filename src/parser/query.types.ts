/**
 *  This is part of the "search query syntax" virtual namespace.  All classes herein are prefixed with SQX to prevent common names from polluting the global
 *  namespace.
 *
 *  @author Jorge Mario Valencia <jmvalencia@alertlogic.com>
 *  @author Little Beelzebub <knielsen@alertlogic.com>
 *
 *  @copyright Alert Logic Inc, 2018
 */

import { SQXParseError, SQXToken, SQXOperatorBase, SQXPropertyRef, SQXScalarValue, SQXGroupBase } from './common.types';
import { SQX_ALL_OPERATORS, SQXOperatorAnd, SQXOperatorOr, SQXOperatorProjectAs, SQXComparatorEqual, SQXComparatorIn } from './operator.types';
import { SQX_ALL_CLAUSES, SQXClauseWhere, SQXClauseSelect, SQXClauseOrderBy, SQXClauseGroupBy, SQXClauseGroupByPermuted, SQXClauseHaving, SQXClauseLimit, SQXClauseTimeRange } from './clause.types';
import { SQXParser } from './parser.types';

/**
 * Describes a column (any field or projection that is part of the SELECT statement)
 */
export interface SQXColumnDescriptor
{
    name:string;                //  The textual name of the column
    type:string;                //  The type of the column.  This will be "number" or "any", because that's all of the data we can infer from the raw query.
    asField?: string;           //  The field which references the AS property
    isAggregate?: boolean;      //  Is it an aggregate field
}

export class SQXSearchQuery
{
    public key:               string                   = null;
    public name:              string                   = null;
    public select:            SQXClauseSelect          = null;
    public where:             SQXClauseWhere           = null;
    public order_by:          SQXClauseOrderBy         = null;
    public group_by:          SQXClauseGroupBy         = null;
    public group_by_permuted: SQXClauseGroupByPermuted = null;
    public having:            SQXClauseHaving          = null;
    public limit:             SQXClauseLimit           = null;
    public time_range:        SQXClauseTimeRange       = null;
    public aggregate:         boolean                  = false;

    constructor() {
    }

    /**
     *  Builds a query instance from an SQL-like statement.
     *
     *  @param {string} expression The SQL-like statement.
     *  @return {object} of type SQXSearchQuery.
     */
    public static fromQueryString( expression:string ):SQXSearchQuery {
        let parser      =   new SQXParser();
        parser.evaluate( expression );
        if ( parser.state.errors.length ) {
            console.warn("Errors: ", parser.state.errors );
            throw new Error("Internal error: could not evaluate input expression." );
        }

        return SQXSearchQuery.fromParser( parser );
    }

    /**
     *  Builds a query instance from an SQL-like statement.
     *
     *  @param {string} parser The parser to extract data from.
     *  @return {SQXSearchQuery} The resulting query instance.
     */
    public static fromParser( parser:SQXParser ):SQXSearchQuery {
        let item               =   new SQXSearchQuery();
        item.select            =   parser.select;
        item.where             =   parser.where;
        item.order_by          =   parser.orderBy;
        item.group_by          =   parser.groupBy;
        item.group_by_permuted =   parser.groupByPermuted;
        item.limit             =   parser.limit;
        item.having            =   parser.having;
        return item;
    }

    /**
     *  Builds a query instance from a JSON object in native search format.
     *
     *  @param rawData object with the attributes to set the menu item
     *  @return Object of type SQXSearchQuery
     */
    public static fromJson( rawData: any):SQXSearchQuery {

        let item               =   new SQXSearchQuery();

        item.key               =   rawData.hasOwnProperty("key") ? rawData["key"] : null;
        item.name              =   rawData.hasOwnProperty("name") ? rawData["name"] : null;

        let parser             =   new SQXParser();
        let parsed             =   parser.fromJson(rawData);

        item.select            =   parsed.select || null;
        item.where             =   parsed.where || null;
        item.order_by          =   parsed.order_by || null;
        item.group_by          =   parsed.group_by || null;
        item.group_by_permuted =   parsed.group_by_permuted || null;
        item.limit             =   parsed.limit || null;
        item.having            =   parsed.having || null;
        item.time_range        =   parsed.time_range || null;

        return item;
    }

    /**
     *  Creates an empty query instance.
     */
    public static empty( name:string = "untitled" ):SQXSearchQuery {
        let query = new SQXSearchQuery();
        query.name = name;
        return query;
    }

    /**
     * Exports an instance into native search format JSON.
     */
    public toJson():any {
        let raw = {};
        let properties = [ this.select, this.group_by, this.group_by_permuted, this.order_by, this.limit, this.having, this.where, this.time_range ]
                            .filter( el => el !== null )
                            .reduce( ( accumulator, el ) => Object.assign( accumulator, el.toJson() ), raw );

        if ( this.key ) {
            raw["key"] = this.key;
        }
        if ( this.name ) {
            raw["name"] = this.name;
        }
        return raw;
    }

    /**
     * Exports an instance into SQL-like syntax
     */
    public toQueryString():string {
        let clauses = [];
        if ( this.select ) {
            clauses.push( this.select.toQueryString() );
        }
        if ( this.group_by ) {
            clauses.push( this.group_by.toQueryString() );
        }
        if ( this.group_by_permuted ) {
            clauses.push( this.group_by_permuted.toQueryString() );
        }
        if ( this.having ) {
            clauses.push( this.having.toQueryString() );
        }
        if ( this.where ) {
            clauses.push( this.where.toQueryString() );
        }
        if ( this.order_by ) {
            clauses.push( this.order_by.toQueryString() );
        }
        if ( this.limit ) {
            clauses.push( this.limit.toQueryString() );
        }

        return clauses.join(" " );
    }

    /**
     * Retrieves the conditions of the WHERE clause, which will always be an operator (either a coordinating operator like AND or OR, or an actual value test or function).
     * If no condition is already specified, a new one will be created.
     */
    public getConditions():SQXOperatorBase {
        if ( ! this.where ) {
            this.where = new SQXClauseWhere();
            this.where.condition = new SQXOperatorAnd();
        }
        return this.where.condition;
    }

    /**
     * Retrieves top level conditions applied to a given property
     */
    public getPropertyConditions( property:string|SQXPropertyRef ):SQXOperatorBase[] {
        const targetProperty = new SQXToken( property );
        let operators:SQXOperatorBase[] = [];
        this.traverseDescendants( ( token, depth ) => {
                                    if ( token instanceof SQXOperatorBase ) {
                                        if ( token.opPropertyRef.textValue === targetProperty.textValue ) {
                                            operators.push( token );
                                        }
                                    }
                                  }, this.getConditions() );
        return operators;
    }

    /**
     * Retrieves a single condition applied to a given property.  If there are multiple conditions applied to the property, the method
     * will throw an error.
     */
    public getPropertyCondition( property:string|SQXPropertyRef ):SQXOperatorBase|null {
        let operators = this.getPropertyConditions( property );
        if ( operators.length === 0 ) {
            return null;
        } else if ( operators.length > 1 ) {
            throw new Error("getPropertyCondition cannot be used on a query with more than one condition for the target property" );
        } else {
            return operators[0];
        }
    }

    /**
     * Applies an `and` to the conditions clause of the top level WHERE.  Any existing conditions will become part of this AND.
     */
    public and():SQXSearchQuery {
        let existingCondition = this.getConditions();
        if ( ! ( existingCondition instanceof SQXOperatorAnd ) ) {
            let newCondition = new SQXOperatorAnd();
            newCondition.items.push( existingCondition );
            this.where.condition = newCondition;
        }
        return this;
    }

    /**
     * Applies an `or` to the conditions clause of the top level WHERE.  Any existing conditions will become part of this OR.
     */
    public or():SQXSearchQuery {
        let existingCondition = this.getConditions();
        if ( ! ( existingCondition instanceof SQXOperatorOr ) ) {
            let newCondition = new SQXOperatorOr();
            newCondition.items.push( existingCondition );
            this.where.condition = newCondition;
        }
        return this;
    }

    /**
     * Adds an equals operator to the current top level conditions of the WHERE clause.
     */
    public equals( property:string|SQXPropertyRef, value:string|number|boolean|SQXScalarValue ):SQXSearchQuery {
        let conditions = this.getConditions() as SQXGroupBase<SQXOperatorBase>;
        conditions.items.push( new SQXComparatorEqual( property, value ) );
        return this;
    }

    public in( property:string|SQXPropertyRef, values:(string|SQXScalarValue)[] ):SQXSearchQuery {
        let conditions = this.getConditions() as SQXGroupBase<SQXOperatorBase>;
        conditions.items.push( new SQXComparatorIn( property, values ) );
        return this;
    }

    /**
     * Calculates information about the columns described by a given query.
     */
    public getColumnDescriptions():SQXColumnDescriptor[] {
        let results:SQXColumnDescriptor[] = [];
        if ( ! this.select ) {
            return results;
        }
        for ( let i = 0; i < this.select.columns.length; i++ ) {
            let name = null;
            let type = "any";
            let asField = null;
            let isAggregate = false;
            let column = this.select.columns[i];
            if ( column instanceof SQXPropertyRef ) {
                name = column.toQueryString();
            } else if ( column instanceof SQXOperatorProjectAs ) {
                name = column.alias.textValue;
                asField = column.origin.textValue;
                if ( column.origin instanceof SQXOperatorBase ) {
                    type = "number";    //  because, aggregated
                    isAggregate = true;
                    this.aggregate = isAggregate;
                }
            } else if ( column instanceof SQXOperatorBase ) {
                name = column.toQueryString();
                type = "number";        //  because, aggregated
            } else {
                console.warn("Skipping unknown column in select property list", column );
                continue;
            }
            results.push( {
                name: name,
                type: type,
                asField: asField,
                isAggregate: isAggregate
            } );
        }
        return results;
    }

    /**
     *  It triggers the column's descriptions process so we know also if the query is aggregate.
     */
    public isAggregate(): boolean {
        this.getColumnDescriptions();
        return this.aggregate;
    }

    /**
     * Executes a callback against every token in the *idealized* token tree.
     * This is in contrast to the raw token traversal seen in SQXParser's `withTokens` method.
     *
     * @param {function} callback A callback method accepting a single token.
     * @param {SQXToken} from The starting point to traverse from; if null (default), enumerates all top level clauses except time range.
     * @param {depth} The current depth of execution.
     */
    public traverseDescendants( callback:{(token:SQXToken,depth?:number):void}, from:SQXToken = null, depth:number = 0 ) {
        if ( from === null ) {
            //  Enumerate all top-level clauses
            [this.select, this.where, this.order_by, this.group_by, this.group_by_permuted, this.having, this.limit]
                .filter( x => x )
                .map( x => this.traverseDescendants( callback, x, depth ) );
        } else if ( from instanceof SQXGroupBase ) {
            //  AND, OR, token collection -- enumerate all items
            from.items.map( x => this.traverseDescendants( callback, x, depth + 1 ) );
        } else if ( from instanceof SQXOperatorBase ) {
            //  A discrete operator
            callback( from, depth );
            let descendants = from.getDescendants();
            descendants.map( d => this.traverseDescendants( callback, d, depth + 1 ) );
        } else {
            callback( from, depth );
        }
    }
}

