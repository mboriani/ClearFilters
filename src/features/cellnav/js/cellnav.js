(function () {
  'use strict';

  /**
   *  @ngdoc overview
   *  @name ui.grid.cellNav
   *
   *  @description

      #ui.grid.cellNav

      <div class="alert alert-success" role="alert"><strong>Stable</strong> This feature is stable. There should no longer be breaking api changes without a deprecation warning.</div>

      This module provides auto-resizing functionality to UI-Grid.
   */
  var module = angular.module('ui.grid.cellNav', ['ui.grid']);

  /**
   *  @ngdoc object
   *  @name ui.grid.cellNav.constant:uiGridCellNavConstants
   *
   *  @description constants available in cellNav
   */
  module.constant('uiGridCellNavConstants', {
    FEATURE_NAME: 'gridCellNav',
    CELL_NAV_EVENT: 'cellNav',
    direction: {LEFT: 0, RIGHT: 1, UP: 2, DOWN: 3, PG_UP: 4, PG_DOWN: 5},
    EVENT_TYPE: {
      KEYDOWN: 0,
      CLICK: 1,
      CLEAR: 2
    }
  });

  /**
   * @ngdoc object
   * @name ui.grid.cellNav.object:RowCol
   * @param {GridRow} row The row for this pair
   * @param {GridColumn} column The column for this pair
   * @description A row and column pair that represents the intersection of these two entities.
   */
  module.factory('RowColFactory', ['$parse', '$filter',
    function($parse, $filter){
      var RowCol = function RowCol(row, col) {
        /**
         * @ngdoc object
         * @name row
         * @propertyOf ui.grid.cellNav.object:RowCol
         * @description {@link ui.grid.class:GridRow }
         */
        this.row = row;
        /**
         * @ngdoc object
         * @name col
         * @propertyOf ui.grid.cellNav.object:RowCol
         * @description {@link ui.grid.class:GridColumn }
         */
        this.col = col;
      };

      /**
       * @ngdoc function
       * @name getIntersectionValueRaw
       * @methodOf ui.grid.cellNav.object:RowCol
       * @description Gets the intersection of where the row and column meet.
       * @returns {String|Number|Object} The value from the grid data that this RowCol points too.
       *          If the column has a cellFilter this will NOT return the filtered value.
       */
      RowCol.prototype.getIntersectionValueRaw = function(){
        var getter = $parse(this.col.field);
        var context = this.row.entity;
        return getter(context);
      };
      /**
       * @ngdoc function
       * @name getIntersectionValueFiltered
       * @methodOf ui.grid.cellNav.object:RowCol
       * @description Gets the intersection of where the row and column meet.
       * @returns {String|Number|Object} The value from the grid data that this RowCol points too.
       *          If the column has a cellFilter this will also apply the filter to it and return the value that the filter displays.
       */
      RowCol.prototype.getIntersectionValueFiltered = function(){
        var value = this.getIntersectionValueRaw();
        if (this.col.cellFilter && this.col.cellFilter !== ''){
          var getFilterIfExists = function(filterName){
            try {
              return $filter(filterName);
            } catch (e){
              return null;
            }
          };
          var filter = getFilterIfExists(this.col.cellFilter);
          if (filter) { // Check if this is filter name or a filter string
            value = filter(value);
          } else { // We have the template version of a filter so we need to parse it apart
            // Get the filter params out using a regex
            // Test out this regex here https://regex101.com/r/rC5eR5/2
            var re = /([^:]*):([^:]*):?([\s\S]+)?/;
            var matches;
            if ((matches = re.exec(this.col.cellFilter)) !== null) {
                // View your result using the matches-variable.
                // eg matches[0] etc.
                value = $filter(matches[1])(value, matches[2], matches[3]);
            }
          }
        }
        return value;
      };
      return RowCol;
    }]);


  module.factory('uiGridCellNavFactory', ['gridUtil', 'uiGridConstants', 'uiGridCellNavConstants', 'RowColFactory', '$q',
    function (gridUtil, uiGridConstants, uiGridCellNavConstants, RowCol, $q) {
      /**
       *  @ngdoc object
       *  @name ui.grid.cellNav.object:CellNav
       *  @description returns a CellNav prototype function
       *  @param {object} rowContainer container for rows
       *  @param {object} colContainer parent column container
       *  @param {object} leftColContainer column container to the left of parent
       *  @param {object} rightColContainer column container to the right of parent
       */
      var UiGridCellNav = function UiGridCellNav(rowContainer, colContainer, leftColContainer, rightColContainer) {
        this.rows = rowContainer.visibleRowCache;
        this.columns = colContainer.visibleColumnCache;
        this.leftColumns = leftColContainer ? leftColContainer.visibleColumnCache : [];
        this.rightColumns = rightColContainer ? rightColContainer.visibleColumnCache : [];
        this.bodyContainer = rowContainer;
      };

      /** returns focusable columns of all containers */
      UiGridCellNav.prototype.getFocusableCols = function () {
        var allColumns = this.leftColumns.concat(this.columns, this.rightColumns);

        return allColumns.filter(function (col) {
          return col.colDef.allowCellFocus;
        });
      };

      /**
       *  @ngdoc object
       *  @name ui.grid.cellNav.api:GridRow
       *
       *  @description GridRow settings for cellNav feature, these are available to be
       *  set only internally (for example, by other features)
       */

      /**
       *  @ngdoc object
       *  @name allowCellFocus
       *  @propertyOf  ui.grid.cellNav.api:GridRow
       *  @description Enable focus on a cell within this row.  If set to false then no cells
       *  in this row can be focused - group header rows as an example would set this to false.
       *  <br/>Defaults to true
       */
      /** returns focusable rows */
      UiGridCellNav.prototype.getFocusableRows = function () {
        return this.rows.filter(function(row) {
          return row.allowCellFocus !== false;
        });
      };

      UiGridCellNav.prototype.getNextRowCol = function (direction, curRow, curCol) {
        switch (direction) {
          case uiGridCellNavConstants.direction.LEFT:
            return this.getRowColLeft(curRow, curCol);
          case uiGridCellNavConstants.direction.RIGHT:
            return this.getRowColRight(curRow, curCol);
          case uiGridCellNavConstants.direction.UP:
            return this.getRowColUp(curRow, curCol);
          case uiGridCellNavConstants.direction.DOWN:
            return this.getRowColDown(curRow, curCol);
          case uiGridCellNavConstants.direction.PG_UP:
            return this.getRowColPageUp(curRow, curCol);
          case uiGridCellNavConstants.direction.PG_DOWN:
            return this.getRowColPageDown(curRow, curCol);
        }

      };

      UiGridCellNav.prototype.initializeSelection = function () {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        if (focusableCols.length === 0 || focusableRows.length === 0) {
          return null;
        }

        var curRowIndex = 0;
        var curColIndex = 0;
        return new RowCol(focusableRows[0], focusableCols[0]); //return same row
      };

      UiGridCellNav.prototype.getRowColLeft = function (curRow, curCol) {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        var curColIndex = focusableCols.indexOf(curCol);
        var curRowIndex = focusableRows.indexOf(curRow);

        //could not find column in focusable Columns so set it to 1
        if (curColIndex === -1) {
          curColIndex = 1;
        }

        var nextColIndex = curColIndex === 0 ? focusableCols.length - 1 : curColIndex - 1;

        //get column to left
        if (nextColIndex > curColIndex) {
          // On the first row
          // if (curRowIndex === 0 && curColIndex === 0) {
          //   return null;
          // }
          if (curRowIndex === 0) {
            return new RowCol(curRow, focusableCols[nextColIndex]); //return same row
          }
          else {
            //up one row and far right column
            return new RowCol(focusableRows[curRowIndex - 1], focusableCols[nextColIndex]);
          }
        }
        else {
          return new RowCol(curRow, focusableCols[nextColIndex]);
        }
      };



      UiGridCellNav.prototype.getRowColRight = function (curRow, curCol) {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        var curColIndex = focusableCols.indexOf(curCol);
        var curRowIndex = focusableRows.indexOf(curRow);

        //could not find column in focusable Columns so set it to 0
        if (curColIndex === -1) {
          curColIndex = 0;
        }
        var nextColIndex = curColIndex === focusableCols.length - 1 ? 0 : curColIndex + 1;

        if (nextColIndex < curColIndex) {
          if (curRowIndex === focusableRows.length - 1) {
            return new RowCol(curRow, focusableCols[nextColIndex]); //return same row
          }
          else {
            //down one row and far left column
            return new RowCol(focusableRows[curRowIndex + 1], focusableCols[nextColIndex]);
          }
        }
        else {
          return new RowCol(curRow, focusableCols[nextColIndex]);
        }
      };

      UiGridCellNav.prototype.getRowColDown = function (curRow, curCol) {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        var curColIndex = focusableCols.indexOf(curCol);
        var curRowIndex = focusableRows.indexOf(curRow);

        //could not find column in focusable Columns so set it to 0
        if (curColIndex === -1) {
          curColIndex = 0;
        }

        if (curRowIndex === focusableRows.length - 1) {
          return new RowCol(curRow, focusableCols[curColIndex]); //return same row
        }
        else {
          //down one row
          return new RowCol(focusableRows[curRowIndex + 1], focusableCols[curColIndex]);
        }
      };

      UiGridCellNav.prototype.getRowColPageDown = function (curRow, curCol) {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        var curColIndex = focusableCols.indexOf(curCol);
        var curRowIndex = focusableRows.indexOf(curRow);

        //could not find column in focusable Columns so set it to 0
        if (curColIndex === -1) {
          curColIndex = 0;
        }

        var pageSize = this.bodyContainer.minRowsToRender();
        if (curRowIndex >= focusableRows.length - pageSize) {
          return new RowCol(focusableRows[focusableRows.length - 1], focusableCols[curColIndex]); //return last row
        }
        else {
          //down one page
          return new RowCol(focusableRows[curRowIndex + pageSize], focusableCols[curColIndex]);
        }
      };

      UiGridCellNav.prototype.getRowColUp = function (curRow, curCol) {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        var curColIndex = focusableCols.indexOf(curCol);
        var curRowIndex = focusableRows.indexOf(curRow);

        //could not find column in focusable Columns so set it to 0
        if (curColIndex === -1) {
          curColIndex = 0;
        }

        if (curRowIndex === 0) {
          return new RowCol(curRow, focusableCols[curColIndex]); //return same row
        }
        else {
          //up one row
          return new RowCol(focusableRows[curRowIndex - 1], focusableCols[curColIndex]);
        }
      };

      UiGridCellNav.prototype.getRowColPageUp = function (curRow, curCol) {
        var focusableCols = this.getFocusableCols();
        var focusableRows = this.getFocusableRows();
        var curColIndex = focusableCols.indexOf(curCol);
        var curRowIndex = focusableRows.indexOf(curRow);

        //could not find column in focusable Columns so set it to 0
        if (curColIndex === -1) {
          curColIndex = 0;
        }

        var pageSize = this.bodyContainer.minRowsToRender();
        if (curRowIndex - pageSize < 0) {
          return new RowCol(focusableRows[0], focusableCols[curColIndex]); //return first row
        }
        else {
          //up one page
          return new RowCol(focusableRows[curRowIndex - pageSize], focusableCols[curColIndex]);
        }
      };
      return UiGridCellNav;
    }]);

  /**
   *  @ngdoc service
   *  @name ui.grid.cellNav.service:uiGridCellNavService
   *
   *  @description Services for cell navigation features. If you don't like the key maps we use,
   *  or the direction cells navigation, override with a service decorator (see angular docs)
   */
  module.service('uiGridCellNavService', ['gridUtil', 'uiGridConstants', 'uiGridCellNavConstants', '$q', 'uiGridCellNavFactory', 'RowColFactory', 'ScrollEvent',
    function (gridUtil, uiGridConstants, uiGridCellNavConstants, $q, UiGridCellNav, RowCol, ScrollEvent) {

      var service = {

        initializeGrid: function (grid) {
          grid.registerColumnBuilder(service.cellNavColumnBuilder);


          /**
           *  @ngdoc object
           *  @name ui.grid.cellNav:Grid.cellNav
           * @description cellNav properties added to grid class
           */
          grid.cellNav = {};
          grid.cellNav.lastRowCol = null;
          grid.cellNav.focusedCells = [];

          service.defaultGridOptions(grid.options);

          /**
           *  @ngdoc object
           *  @name ui.grid.cellNav.api:PublicApi
           *
           *  @description Public Api for cellNav feature
           */
          var publicApi = {
            events: {
              cellNav: {
                /**
                 * @ngdoc event
                 * @name navigate
                 * @eventOf  ui.grid.cellNav.api:PublicApi
                 * @description raised when the active cell is changed
                 * <pre>
                 *      gridApi.cellNav.on.navigate(scope,function(newRowcol, oldRowCol){})
                 * </pre>
                 * @param {object} newRowCol new position
                 * @param {object} oldRowCol old position
                 */
                navigate: function (newRowCol, oldRowCol) {},
                /**
                 * @ngdoc event
                 * @name viewPortKeyDown
                 * @eventOf  ui.grid.cellNav.api:PublicApi
                 * @description  is raised when the viewPort receives a keyDown event. Cells never get focus in uiGrid
                 * due to the difficulties of setting focus on a cell that is not visible in the viewport.  Use this
                 * event whenever you need a keydown event on a cell
                 * <br/>
                 * @param {object} event keydown event
                 * @param {object} rowCol current rowCol position
                 */
                viewPortKeyDown: function (event, rowCol) {},

                /**
                 * @ngdoc event
                 * @name viewPortKeyPress
                 * @eventOf  ui.grid.cellNav.api:PublicApi
                 * @description  is raised when the viewPort receives a keyPress event. Cells never get focus in uiGrid
                 * due to the difficulties of setting focus on a cell that is not visible in the viewport.  Use this
                 * event whenever you need a keypress event on a cell
                 * <br/>
                 * @param {object} event keypress event
                 * @param {object} rowCol current rowCol position
                 */
                viewPortKeyPress: function (event, rowCol) {}
              }
            },
            methods: {
              cellNav: {
                /**
                 * @ngdoc function
                 * @name scrollToFocus
                 * @methodOf  ui.grid.cellNav.api:PublicApi
                 * @description brings the specified row and column into view, and sets focus
                 * to that cell
                 * @param {object} rowEntity gridOptions.data[] array instance to make visible and set focus
                 * @param {object} colDef to make visible and set focus
                 * @returns {promise} a promise that is resolved after any scrolling is finished
                 */
                scrollToFocus: function (rowEntity, colDef) {
                  return service.scrollToFocus(grid, rowEntity, colDef);
                },

                /**
                 * @ngdoc function
                 * @name getFocusedCell
                 * @methodOf  ui.grid.cellNav.api:PublicApi
                 * @description returns the current (or last if Grid does not have focus) focused row and column
                 * <br> value is null if no selection has occurred
                 */
                getFocusedCell: function () {
                  return grid.cellNav.lastRowCol;
                },

                /**
                 * @ngdoc function
                 * @name getCurrentSelection
                 * @methodOf  ui.grid.cellNav.api:PublicApi
                 * @description returns an array containing the current selection
                 * <br> array is empty if no selection has occurred
                 */
                getCurrentSelection: function () {
                  return grid.cellNav.focusedCells;
                },

                /**
                 * @ngdoc function
                 * @name rowColSelectIndex
                 * @methodOf  ui.grid.cellNav.api:PublicApi
                 * @description returns the index in the order in which the RowCol was selected, returns -1 if the RowCol
                 * isn't selected
                 * @param {object} rowCol the rowCol to evaluate
                 */
                rowColSelectIndex: function (rowCol) {
                  //return gridUtil.arrayContainsObjectWithProperty(grid.cellNav.focusedCells, 'col.uid', rowCol.col.uid) &&
                  var index = -1;
                  for (var i = 0; i < grid.cellNav.focusedCells.length; i++) {
                    if (grid.cellNav.focusedCells[i].col.uid === rowCol.col.uid &&
                      grid.cellNav.focusedCells[i].row.uid === rowCol.row.uid) {
                      index = i;
                      break;
                    }
                  }
                  return index;
                }
              }
            }
          };

          grid.api.registerEventsFromObject(publicApi.events);

          grid.api.registerMethodsFromObject(publicApi.methods);

        },

        defaultGridOptions: function (gridOptions) {
          /**
           *  @ngdoc object
           *  @name ui.grid.cellNav.api:GridOptions
           *
           *  @description GridOptions for cellNav feature, these are available to be
           *  set using the ui-grid {@link ui.grid.class:GridOptions gridOptions}
           */

          /**
           *  @ngdoc object
           *  @name modifierKeysToMultiSelectCells
           *  @propertyOf  ui.grid.cellNav.api:GridOptions
           *  @description Enable multiple cell selection only when using the ctrlKey or shiftKey.
           *  <br/>Defaults to false
           */
          gridOptions.modifierKeysToMultiSelectCells = gridOptions.modifierKeysToMultiSelectCells === true;

        },

        /**
         * @ngdoc service
         * @name decorateRenderContainers
         * @methodOf ui.grid.cellNav.service:uiGridCellNavService
         * @description  decorates grid renderContainers with cellNav functions
         */
        decorateRenderContainers: function (grid) {

          var rightContainer = grid.hasRightContainer() ? grid.renderContainers.right : null;
          var leftContainer = grid.hasLeftContainer() ? grid.renderContainers.left : null;

          if (leftContainer !== null) {
            grid.renderContainers.left.cellNav = new UiGridCellNav(grid.renderContainers.body, leftContainer, rightContainer, grid.renderContainers.body);
          }
          if (rightContainer !== null) {
            grid.renderContainers.right.cellNav = new UiGridCellNav(grid.renderContainers.body, rightContainer, grid.renderContainers.body, leftContainer);
          }

          grid.renderContainers.body.cellNav = new UiGridCellNav(grid.renderContainers.body, grid.renderContainers.body, leftContainer, rightContainer);
        },

        /**
         * @ngdoc service
         * @name getDirection
         * @methodOf ui.grid.cellNav.service:uiGridCellNavService
         * @description  determines which direction to for a given keyDown event
         * @returns {uiGridCellNavConstants.direction} direction
         */
        getDirection: function (evt) {
          if (evt.keyCode === uiGridConstants.keymap.LEFT ||
            (evt.keyCode === uiGridConstants.keymap.TAB && evt.shiftKey)) {
            return uiGridCellNavConstants.direction.LEFT;
          }
          if (evt.keyCode === uiGridConstants.keymap.RIGHT ||
            evt.keyCode === uiGridConstants.keymap.TAB) {
            return uiGridCellNavConstants.direction.RIGHT;
          }

          if (evt.keyCode === uiGridConstants.keymap.UP ||
            (evt.keyCode === uiGridConstants.keymap.ENTER && evt.shiftKey) ) {
            return uiGridCellNavConstants.direction.UP;
          }

          if (evt.keyCode === uiGridConstants.keymap.PG_UP){
            return uiGridCellNavConstants.direction.PG_UP;
          }

          if (evt.keyCode === uiGridConstants.keymap.DOWN ||
            evt.keyCode === uiGridConstants.keymap.ENTER && !(evt.ctrlKey || evt.altKey)) {
            return uiGridCellNavConstants.direction.DOWN;
          }

          if (evt.keyCode === uiGridConstants.keymap.PG_DOWN){
            return uiGridCellNavConstants.direction.PG_DOWN;
          }

          return null;
        },

        /**
         * @ngdoc service
         * @name cellNavColumnBuilder
         * @methodOf ui.grid.cellNav.service:uiGridCellNavService
         * @description columnBuilder function that adds cell navigation properties to grid column
         * @returns {promise} promise that will load any needed templates when resolved
         */
        cellNavColumnBuilder: function (colDef, col, gridOptions) {
          var promises = [];

          /**
           *  @ngdoc object
           *  @name ui.grid.cellNav.api:ColumnDef
           *
           *  @description Column Definitions for cellNav feature, these are available to be
           *  set using the ui-grid {@link ui.grid.class:GridOptions.columnDef gridOptions.columnDefs}
           */

          /**
           *  @ngdoc object
           *  @name allowCellFocus
           *  @propertyOf  ui.grid.cellNav.api:ColumnDef
           *  @description Enable focus on a cell within this column.
           *  <br/>Defaults to true
           */
          colDef.allowCellFocus = colDef.allowCellFocus === undefined ? true : colDef.allowCellFocus;

          return $q.all(promises);
        },

        /**
         * @ngdoc method
         * @methodOf ui.grid.cellNav.service:uiGridCellNavService
         * @name scrollToFocus
         * @description Scroll the grid such that the specified
         * row and column is in view, and set focus to the cell in that row and column
         * @param {Grid} grid the grid you'd like to act upon, usually available
         * from gridApi.grid
         * @param {object} rowEntity gridOptions.data[] array instance to make visible and set focus to
         * @param {object} colDef to make visible and set focus to
         * @returns {promise} a promise that is resolved after any scrolling is finished
         */
        scrollToFocus: function (grid, rowEntity, colDef) {
          var gridRow = null, gridCol = null;

          if (typeof(rowEntity) !== 'undefined' && rowEntity !== null) {
            gridRow = grid.getRow(rowEntity);
          }

          if (typeof(colDef) !== 'undefined' && colDef !== null) {
            gridCol = grid.getColumn(colDef.name ? colDef.name : colDef.field);
          }
          return grid.api.core.scrollToIfNecessary(gridRow, gridCol).then(function () {
            var rowCol = { row: gridRow, col: gridCol };

            // Broadcast the navigation
            if (gridRow !== null && gridCol !== null) {
              grid.cellNav.broadcastCellNav(rowCol);
            }
          });



        },


        /**
         * @ngdoc method
         * @methodOf ui.grid.cellNav.service:uiGridCellNavService
         * @name getLeftWidth
         * @description Get the current drawn width of the columns in the
         * grid up to the numbered column, and add an apportionment for the
         * column that we're on.  So if we are on column 0, we want to scroll
         * 0% (i.e. exclude this column from calc).  If we're on the last column
         * we want to scroll to 100% (i.e. include this column in the calc). So
         * we include (thisColIndex / totalNumberCols) % of this column width
         * @param {Grid} grid the grid you'd like to act upon, usually available
         * from gridApi.grid
         * @param {gridCol} upToCol the column to total up to and including
         */
        getLeftWidth: function (grid, upToCol) {
          var width = 0;

          if (!upToCol) {
            return width;
          }

          var lastIndex = grid.renderContainers.body.visibleColumnCache.indexOf( upToCol );

          // total column widths up-to but not including the passed in column
          grid.renderContainers.body.visibleColumnCache.forEach( function( col, index ) {
            if ( index < lastIndex ){
              width += col.drawnWidth;
            }
          });

          // pro-rata the final column based on % of total columns.
          var percentage = lastIndex === 0 ? 0 : (lastIndex + 1) / grid.renderContainers.body.visibleColumnCache.length;
          width += upToCol.drawnWidth * percentage;

          return width;
        }
      };

      return service;
    }]);

  /**
   *  @ngdoc directive
   *  @name ui.grid.cellNav.directive:uiCellNav
   *  @element div
   *  @restrict EA
   *
   *  @description Adds cell navigation features to the grid columns
   *
   *  @example
   <example module="app">
   <file name="app.js">
   var app = angular.module('app', ['ui.grid', 'ui.grid.cellNav']);

   app.controller('MainCtrl', ['$scope', function ($scope) {
      $scope.data = [
        { name: 'Bob', title: 'CEO' },
            { name: 'Frank', title: 'Lowly Developer' }
      ];

      $scope.columnDefs = [
        {name: 'name'},
        {name: 'title'}
      ];
    }]);
   </file>
   <file name="index.html">
   <div ng-controller="MainCtrl">
   <div ui-grid="{ data: data, columnDefs: columnDefs }" ui-grid-cellnav></div>
   </div>
   </file>
   </example>
   */
  module.directive('uiGridCellnav', ['gridUtil', 'uiGridCellNavService', 'uiGridCellNavConstants', 'uiGridConstants', 'RowColFactory', '$timeout', '$compile',
    function (gridUtil, uiGridCellNavService, uiGridCellNavConstants, uiGridConstants, RowCol, $timeout, $compile) {
      return {
        replace: true,
        priority: -150,
        require: '^uiGrid',
        scope: false,
        controller: function () {},
        compile: function () {
          return {
            pre: function ($scope, $elm, $attrs, uiGridCtrl) {
              var _scope = $scope;

              var grid = uiGridCtrl.grid;
              uiGridCellNavService.initializeGrid(grid);

              uiGridCtrl.cellNav = {};

              //Ensure that the object has all of the methods we expect it to
              uiGridCtrl.cellNav.makeRowCol = function (obj) {
                if (!(obj instanceof RowCol)) {
                  obj = new RowCol(obj.row, obj.col);
                }
                return obj;
              };

              uiGridCtrl.cellNav.getActiveCell = function () {
                var elms = $elm[0].getElementsByClassName('ui-grid-cell-focus');
                if (elms.length > 0){
                  return elms[0];
                }

                return undefined;
              };

              uiGridCtrl.cellNav.broadcastCellNav = grid.cellNav.broadcastCellNav = function (newRowCol, modifierDown, originEvt) {
                modifierDown = !(modifierDown === undefined || !modifierDown);

                newRowCol = uiGridCtrl.cellNav.makeRowCol(newRowCol);

                uiGridCtrl.cellNav.broadcastFocus(newRowCol, modifierDown, originEvt);
                _scope.$broadcast(uiGridCellNavConstants.CELL_NAV_EVENT, newRowCol, modifierDown, originEvt);
              };

              uiGridCtrl.cellNav.clearFocus = grid.cellNav.clearFocus = function () {
                grid.cellNav.focusedCells = [];
                _scope.$broadcast(uiGridCellNavConstants.CELL_NAV_EVENT);
              };

              uiGridCtrl.cellNav.broadcastFocus = function (rowCol, modifierDown, originEvt) {
                modifierDown = !(modifierDown === undefined || !modifierDown);

                rowCol = uiGridCtrl.cellNav.makeRowCol(rowCol);

                var row = rowCol.row,
                  col = rowCol.col;

                var rowColSelectIndex = uiGridCtrl.grid.api.cellNav.rowColSelectIndex(rowCol);

                if (grid.cellNav.lastRowCol === null || rowColSelectIndex === -1) {
                  var newRowCol = new RowCol(row, col);

                  grid.api.cellNav.raise.navigate(newRowCol, grid.cellNav.lastRowCol);
                  grid.cellNav.lastRowCol = newRowCol;
                  if (uiGridCtrl.grid.options.modifierKeysToMultiSelectCells && modifierDown) {
                    grid.cellNav.focusedCells.push(rowCol);
                  } else {
                    grid.cellNav.focusedCells = [rowCol];
                  }
                } else if (grid.options.modifierKeysToMultiSelectCells && modifierDown &&
                  rowColSelectIndex >= 0) {

                  grid.cellNav.focusedCells.splice(rowColSelectIndex, 1);
                }
              };

              uiGridCtrl.cellNav.handleKeyDown = function (evt) {
                var direction = uiGridCellNavService.getDirection(evt);
                if (direction === null) {
                  return null;
                }

                var containerId = 'body';
                if (evt.uiGridTargetRenderContainerId) {
                  containerId = evt.uiGridTargetRenderContainerId;
                }

                // Get the last-focused row+col combo
                var lastRowCol = uiGridCtrl.grid.api.cellNav.getFocusedCell();
                if (lastRowCol) {
                  // Figure out which new row+combo we're navigating to
                  var rowCol = uiGridCtrl.grid.renderContainers[containerId].cellNav.getNextRowCol(direction, lastRowCol.row, lastRowCol.col);
                  var focusableCols = uiGridCtrl.grid.renderContainers[containerId].cellNav.getFocusableCols();
                  var rowColSelectIndex = uiGridCtrl.grid.api.cellNav.rowColSelectIndex(rowCol);
                  // Shift+tab on top-left cell should exit cellnav on render container
                  if (
                    // Navigating left
                    direction === uiGridCellNavConstants.direction.LEFT &&
                    // New col is last col (i.e. wrap around)
                    rowCol.col === focusableCols[focusableCols.length - 1] &&
                    // Staying on same row, which means we're at first row
                    rowCol.row === lastRowCol.row &&
                    evt.keyCode === uiGridConstants.keymap.TAB &&
                    evt.shiftKey
                  ) {
                    grid.cellNav.focusedCells.splice(rowColSelectIndex, 1);
                    uiGridCtrl.cellNav.clearFocus();
                    return true;
                  }
                  // Tab on bottom-right cell should exit cellnav on render container
                  else if (
                    direction === uiGridCellNavConstants.direction.RIGHT &&
                    // New col is first col (i.e. wrap around)
                    rowCol.col === focusableCols[0] &&
                    // Staying on same row, which means we're at first row
                    rowCol.row === lastRowCol.row &&
                    evt.keyCode === uiGridConstants.keymap.TAB &&
                    !evt.shiftKey
                  ) {
                    grid.cellNav.focusedCells.splice(rowColSelectIndex, 1);
                    uiGridCtrl.cellNav.clearFocus();
                    return true;
                  }

                  // Scroll to the new cell, if it's not completely visible within the render container's viewport
                  grid.scrollToIfNecessary(rowCol.row, rowCol.col).then(function () {
                    uiGridCtrl.cellNav.broadcastCellNav(rowCol);
                  });


                  evt.stopPropagation();
                  evt.preventDefault();

                  return false;
                }
              };
            },
            post: function ($scope, $elm, $attrs, uiGridCtrl) {
              var _scope = $scope;
              var grid = uiGridCtrl.grid;

              function addAriaLiveRegion(){
                // Thanks to google docs for the inspiration behind how to do this
                // XXX: Why is this entire mess nessasary?
                // Because browsers take a lot of coercing to get them to read out live regions
                //http://www.paciellogroup.com/blog/2012/06/html5-accessibility-chops-aria-rolealert-browser-support/
                var ariaNotifierDomElt = '<div ' +
                                           'id="' + grid.id +'-aria-speakable" ' +
                                           'class="ui-grid-a11y-ariascreenreader-speakable ui-grid-offscreen" ' +
                                           'aria-live="assertive" ' +
                                           'role="region" ' +
                                           'aria-atomic="true" ' +
                                           'aria-hidden="false" ' +
                                           'aria-relevant="additions" ' +
                                           '>' +
                                           '&nbsp;' +
                                         '</div>';

                var ariaNotifier = $compile(ariaNotifierDomElt)($scope);
                $elm.prepend(ariaNotifier);
                $scope.$on(uiGridCellNavConstants.CELL_NAV_EVENT, function (evt, rowCol, modifierDown, originEvt) {
                  /*
                   * If the cell nav event was because of a focus event then we don't want to
                   * change the notifier text.
                   * Reasoning: Voice Over fires a focus events when moving arround the grid.
                   * If the screen reader is handing the grid nav properly then we don't need to
                   * use the alert to notify the user of the movement.
                   * In all other cases we do want a notification event.
                   */
                  if (originEvt && originEvt.type === 'focus'){return;}

                  function setNotifyText(text){
                    if (text === ariaNotifier.text()){return;}
                    ariaNotifier[0].style.clip = 'rect(0px,0px,0px,0px)';
                    /*
                     * This is how google docs handles clearing the div. Seems to work better than setting the text of the div to ''
                     */
                    ariaNotifier[0].innerHTML = "";
                    ariaNotifier[0].style.visibility = 'hidden';
                    ariaNotifier[0].style.visibility = 'visible';
                    if (text !== ''){
                      ariaNotifier[0].style.clip = 'auto';
                      /*
                       * The space after the text is something that google docs does.
                       */
                      ariaNotifier[0].appendChild(document.createTextNode(text + " "));
                      ariaNotifier[0].style.visibility = 'hidden';
                      ariaNotifier[0].style.visibility = 'visible';
                    }
                  }

                  var values = [];
                  var currentSelection = grid.api.cellNav.getCurrentSelection();
                  for (var i = 0; i < currentSelection.length; i++) {
                    values.push(currentSelection[i].getIntersectionValueFiltered());
                  }
                  var cellText = values.toString();
                  setNotifyText(cellText);

                });
              }
              addAriaLiveRegion();
            }
          };
        }
      };
    }]);

  module.directive('uiGridRenderContainer', ['$timeout', '$document', 'gridUtil', 'uiGridConstants', 'uiGridCellNavService', '$compile','uiGridCellNavConstants',
    function ($timeout, $document, gridUtil, uiGridConstants, uiGridCellNavService, $compile, uiGridCellNavConstants) {
      return {
        replace: true,
        priority: -99999, //this needs to run very last
        require: ['^uiGrid', 'uiGridRenderContainer', '?^uiGridCellnav'],
        scope: false,
        compile: function () {
          return {
            post: function ($scope, $elm, $attrs, controllers) {
              var uiGridCtrl = controllers[0],
                 renderContainerCtrl = controllers[1],
                 uiGridCellnavCtrl = controllers[2];

              // Skip attaching cell-nav specific logic if the directive is not attached above us
              if (!uiGridCtrl.grid.api.cellNav) { return; }

              var containerId = renderContainerCtrl.containerId;

              var grid = uiGridCtrl.grid;

              // focusser only created for body
              if (containerId !== 'body') {
                return;
              }

              // Needs to run last after all renderContainers are built
              uiGridCellNavService.decorateRenderContainers(grid);

              if (uiGridCtrl.grid.options.modifierKeysToMultiSelectCells){
                $elm.attr('aria-multiselectable', true);
              } else {
                $elm.attr('aria-multiselectable', false);
              }

              //add an element with no dimensions that can be used to set focus and capture keystrokes
              var focuser = $compile('<div class="ui-grid-focuser" role="region" aria-live="assertive" aria-atomic="false" tabindex="0" aria-controls="' + grid.id +'-aria-speakable '+ grid.id + '-grid-container' +'" aria-owns="' + grid.id + '-grid-container' + '"></div>')($scope);
              $elm.append(focuser);

              focuser.on('focus', function (evt) {
                evt.uiGridTargetRenderContainerId = containerId;
                var rowCol = uiGridCtrl.grid.api.cellNav.getFocusedCell();
                if (rowCol === null) {
                  rowCol = uiGridCtrl.grid.renderContainers[containerId].cellNav.getNextRowCol(uiGridCellNavConstants.direction.DOWN, null, null);
                  if (rowCol.row && rowCol.col) {
                    uiGridCtrl.cellNav.broadcastCellNav(rowCol);
                  }
                }
              });

              uiGridCellnavCtrl.setAriaActivedescendant = function(id){
                $elm.attr('aria-activedescendant', id);
              };

              uiGridCellnavCtrl.removeAriaActivedescendant = function(id){
                if ($elm.attr('aria-activedescendant') === id){
                  $elm.attr('aria-activedescendant', '');
                }
              };


              uiGridCtrl.focus = function () {
                gridUtil.focus.byElement(focuser[0]);
                //allow for first time grid focus
              };

              var viewPortKeyDownWasRaisedForRowCol = null;
              // Bind to keydown events in the render container
              focuser.on('keydown', function (evt) {
                evt.uiGridTargetRenderContainerId = containerId;
                var rowCol = uiGridCtrl.grid.api.cellNav.getFocusedCell();
                var result = uiGridCtrl.cellNav.handleKeyDown(evt);
                if (result === null) {
                  uiGridCtrl.grid.api.cellNav.raise.viewPortKeyDown(evt, rowCol);
                  viewPortKeyDownWasRaisedForRowCol = rowCol;
                }
              });
              //Bind to keypress events in the render container
              //keypress events are needed by edit function so the key press
              //that initiated an edit is not lost
              //must fire the event in a timeout so the editor can
              //initialize and subscribe to the event on another event loop
              focuser.on('keypress', function (evt) {
                if (viewPortKeyDownWasRaisedForRowCol) {
                  $timeout(function () {
                    uiGridCtrl.grid.api.cellNav.raise.viewPortKeyPress(evt, viewPortKeyDownWasRaisedForRowCol);
                  },4);

                  viewPortKeyDownWasRaisedForRowCol = null;
                }
              });

              $scope.$on('$destroy', function(){
                //Remove all event handlers associated with this focuser.
                focuser.off();
              });

            }
          };
        }
      };
    }]);

  module.directive('uiGridViewport', ['$timeout', '$document', 'gridUtil', 'uiGridConstants', 'uiGridCellNavService', 'uiGridCellNavConstants','$log','$compile',
    function ($timeout, $document, gridUtil, uiGridConstants, uiGridCellNavService, uiGridCellNavConstants, $log, $compile) {
      return {
        replace: true,
        priority: -99999, //this needs to run very last
        require: ['^uiGrid', '^uiGridRenderContainer', '?^uiGridCellnav'],
        scope: false,
        compile: function () {
          return {
            pre: function ($scope, $elm, $attrs, uiGridCtrl) {
            },
            post: function ($scope, $elm, $attrs, controllers) {
              var uiGridCtrl = controllers[0],
                renderContainerCtrl = controllers[1];

              // Skip attaching cell-nav specific logic if the directive is not attached above us
              if (!uiGridCtrl.grid.api.cellNav) { return; }

              var containerId = renderContainerCtrl.containerId;
              //no need to process for other containers
              if (containerId !== 'body') {
                return;
              }

              var grid = uiGridCtrl.grid;

              grid.api.core.on.scrollBegin($scope, function (args) {

                // Skip if there's no currently-focused cell
                var lastRowCol = uiGridCtrl.grid.api.cellNav.getFocusedCell();
                if (lastRowCol === null) {
                  return;
                }

                //if not in my container, move on
                //todo: worry about horiz scroll
                if (!renderContainerCtrl.colContainer.containsColumn(lastRowCol.col)) {
                  return;
                }

                uiGridCtrl.cellNav.clearFocus();

              });

              grid.api.core.on.scrollEnd($scope, function (args) {
                // Skip if there's no currently-focused cell
                var lastRowCol = uiGridCtrl.grid.api.cellNav.getFocusedCell();
                if (lastRowCol === null) {
                  return;
                }

                //if not in my container, move on
                //todo: worry about horiz scroll
                if (!renderContainerCtrl.colContainer.containsColumn(lastRowCol.col)) {
                  return;
                }

                uiGridCtrl.cellNav.broadcastCellNav(lastRowCol);

              });

              grid.api.cellNav.on.navigate($scope, function () {
                //focus again because it can be lost
                 uiGridCtrl.focus();
              });

            }
          };
        }
      };
    }]);

  /**
   *  @ngdoc directive
   *  @name ui.grid.cellNav.directive:uiGridCell
   *  @element div
   *  @restrict A
   *  @description Stacks on top of ui.grid.uiGridCell to provide cell navigation
   */
  module.directive('uiGridCell', ['$timeout', '$document', 'uiGridCellNavService', 'gridUtil', 'uiGridCellNavConstants', 'uiGridConstants', 'RowColFactory',
    function ($timeout, $document, uiGridCellNavService, gridUtil, uiGridCellNavConstants, uiGridConstants, RowCol) {
      return {
        priority: -150, // run after default uiGridCell directive and ui.grid.edit uiGridCell
        restrict: 'A',
        require: ['^uiGrid', '?^uiGridCellnav'],
        scope: false,
        link: function ($scope, $elm, $attrs, controllers) {
          var uiGridCtrl = controllers[0],
              uiGridCellnavCtrl = controllers[1];
          // Skip attaching cell-nav specific logic if the directive is not attached above us
          if (!uiGridCtrl.grid.api.cellNav) { return; }

          if (!$scope.col.colDef.allowCellFocus) {
            return;
          }

          //Convinience local variables
          var grid = uiGridCtrl.grid;
          $scope.focused = false;

          // Make this cell focusable but only with javascript/a mouse click
          $elm.attr('tabindex', -1);

          // When a cell is clicked, broadcast a cellNav event saying that this row+col combo is now focused
          $elm.find('div').on('click', function (evt) {
            uiGridCtrl.cellNav.broadcastCellNav(new RowCol($scope.row, $scope.col), evt.ctrlKey || evt.metaKey, evt);

            evt.stopPropagation();
            $scope.$apply();
          });


          /*
           * XXX Hack for screen readers.
           * This allows the grid to focus using only the screen reader cursor.
           * Since the focus event doesn't include key press information we can't use it
           * as our primary source of the event.
           */
          $elm.on('mousedown', preventMouseDown);

          //turn on and off for edit events
          if (uiGridCtrl.grid.api.edit) {
            uiGridCtrl.grid.api.edit.on.beginCellEdit($scope, function () {
              $elm.off('mousedown', preventMouseDown);
            });

            uiGridCtrl.grid.api.edit.on.afterCellEdit($scope, function () {
              $elm.on('mousedown', preventMouseDown);
            });

            uiGridCtrl.grid.api.edit.on.cancelCellEdit($scope, function () {
              $elm.on('mousedown', preventMouseDown);
            });
          }

          function preventMouseDown(evt) {
            //Prevents the foucus event from firing if the click event is already going to fire.
            //If both events fire it will cause bouncing behavior.
            evt.preventDefault();
          }

          //You can only focus on elements with a tabindex value
          $elm.on('focus', function (evt) {
            uiGridCtrl.cellNav.broadcastCellNav(new RowCol($scope.row, $scope.col), false, evt);
            evt.stopPropagation();
            $scope.$apply();
          });

          // This event is fired for all cells.  If the cell matches, then focus is set
          $scope.$on(uiGridCellNavConstants.CELL_NAV_EVENT, function (evt, rowCol, modifierDown) {
            var isFocused = grid.cellNav.focusedCells.some(function(focusedRowCol, index){
              return (focusedRowCol.row === $scope.row && focusedRowCol.col === $scope.col);
            });
            if (isFocused){
              setFocused();
            } else {
              clearFocus();
            }
          });

          function setFocused() {
            if (!$scope.focused){
              var div = $elm.find('div');
              div.addClass('ui-grid-cell-focus');
              $elm.attr('aria-selected', true);
              uiGridCellnavCtrl.setAriaActivedescendant($elm.attr('id'));
              $scope.focused = true;
            }
          }

          function clearFocus() {
            if ($scope.focused){
              var div = $elm.find('div');
              div.removeClass('ui-grid-cell-focus');
              $elm.attr('aria-selected', false);
              uiGridCellnavCtrl.removeAriaActivedescendant($elm.attr('id'));
              $scope.focused = false;
            }
          }

          $scope.$on('$destroy', function () {
            //.off withouth paramaters removes all handlers
            $elm.find('div').off();
            $elm.off();
          });
        }
      };
    }]);

})();
