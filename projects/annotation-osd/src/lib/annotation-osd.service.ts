import { Inject, Injectable, EventEmitter } from '@angular/core';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Subject } from 'rxjs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { debounceTime } from 'rxjs/operators';
import {
    DrawOptions,
    EventObjectType,
    FabricStyle,
    MarkerPoly,
    MarkerRect,
    MarkerRound,
    Point,
    RegionOfInterest,
} from './annotation-osd.model';

// Load type for openseadragon
export declare type TypeOpenSeadragon = typeof import('openseadragon');
export declare let OpenSeadragon: TypeOpenSeadragon;
// Load type for fabric
export declare type TypeFabric = typeof import('fabric/fabric-impl');
export declare let fabric: TypeFabric;

@Injectable({
    providedIn: 'root',
})
export class AnnotationOSDService {
    protected viewer : OpenSeadragon.Viewer;
    protected canvas :  fabric.Canvas;
    protected imageWidth: number;
    protected imageHeight: number;
    protected containerWidth: number;
    protected containerHeight: number;
    protected zoomToZoomLevelRatio: number;
    protected scale: number;
    protected home : RegionOfInterest | undefined;
    private readonly DEBUG :boolean;
    private readonly DEBUGImage :boolean;
    private drawOptions :  DrawOptions = { isDrawing : false } as DrawOptions;

    /**
     * Subscribe for event on fabric canvas.
     */
    readonly  objectActions: EventEmitter<{ type : EventObjectType, action ?: string | undefined,
        object: MarkerRound | MarkerRect | MarkerPoly | undefined }>
        = new EventEmitter();

    // Fabric Values
    private strokeWidth = 2;
    private dotRadius = 5;

    /**
     * Constructor of service for init a new player.
     * @param debug set true to active debug mode on player.
     * @param debugImage set true to active debug image on player.
     */
    constructor(@Inject(Boolean) debug : boolean = false, @Inject(Boolean) debugImage : boolean = false) {
        this.DEBUGImage = debugImage;
        this.DEBUG = debug;
    }

    /**
     * Ray casting for detrminate if a point is inside a polygon
     * @param p
     * @param vs
     * @private
     */
    private inside(p : any, vs : any)  {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;
            let intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Point inside image
     * @param x
     * @param y
     * @private
     */
    private pointInside(point : Point) {
        const cCoords = [new fabric.Point(0, 0), new fabric.Point( this.imageWidth + 1, 0),
            new  fabric.Point(this.imageWidth + 1, this.imageHeight + 1), new fabric.Point(0, this.imageHeight + 1),
            new fabric.Point(0, 0)];
        return  this.inside(point, cCoords);
    }

    /**
     * Control if object is inside image
     * @param e
     * @private
     */
    private objectInside(object : any) {
        let width = object.scaleX ? object.width * object.scaleX : object.width;
        let height = object.scaleY ?  object.height * object.scaleY : object.height;
        let insideBox;
        if (object.originX === 'center' && object.originY === 'center') {
            insideBox = this.pointInside({
                x: object.left - width / 2,
                y: object.top - height / 2,
            })
                && this.pointInside({
                    x: object.left + width / 2,
                    y: object.top + height / 2,
                });
        } else  {
            insideBox =
                this.pointInside({
                    x: object.left  + (this.strokeWidth / this.canvas.getZoom()) / 2,
                    y: object.top + (this.strokeWidth / this.canvas.getZoom()) / 2,
                })
                && this.pointInside({
                    x: object.left + width + (this.strokeWidth / this.canvas.getZoom()) / 2,
                    y: object.top + height + (this.strokeWidth / this.canvas.getZoom()) / 2,
                });
        }
        return insideBox;
    }

    /**
     * Control if marker is inside image during mooving.
     * @param e
     * @private
     */
    private objectMoving(e : any)  {
        let inBounds = this.objectInside(e.target);
        if (inBounds) {
            e.target.setCoords();
            e.target.saveState();
        } else {
            e.target.left = e.target._stateProperties.left;
            e.target.top = e.target._stateProperties.top;
        }
    }

    /**
     * Control if marker is inside image during scaling.
     * @param e
     * @private
      */
    private objectScaling(e : any)  {
        let inBounds = this.objectInside(e.transform.target);
        if (!inBounds) {
            e.transform.target.scaleY = 1;
            e.transform.target.scaleX = 1;
            e.target.left = e.target._stateProperties.left;
            e.target.top = e.target._stateProperties.top;
            e.target.setCoords();
        } else {
            if (e.target?.scaleX !== 1)  {
                if (!e.target.get('radius'))
                    e.target.set('width', e.target.width * e.target.scaleX);
                e.target.scaleX = 1;
            }
            if (e.target?.scaleY !== 1) {
                if (e.target.get('radius'))
                    e.target.set('radius', e.target.radius * e.target.scaleY);
                else
                    e.target.set('height', e.target.height * e.target.scaleY);
                e.target.scaleY = 1;
            }
        }
    }

    /**
     * Create a new player factory.
     * @param type Type of player, dzi or image (jpeg, png, etc...)
     * @param id Id of player inside html.
     * @param link Link to image.
     */
    public playerFactory(data : OpenSeadragon.Options): Promise<AnnotationOSDService> {
        data.gestureSettingsTouch ??=  { pinchRotate: false } as OpenSeadragon.GestureSettings;
        data.showRotationControl ??= false;
        data.showNavigationControl ??=  false;
        data.showFlipControl ??= false;
        data.maxZoomPixelRatio ??=  5;
        data.zoomPerClick ??=  1;
        data.maxZoomLevel ??= 500;
        data.imageLoaderLimit ??=  1;
        data.constrainDuringPan ??= true;
        data.debugMode = this.DEBUG;

        /**
         * how use tileSources :
         *  -   For xml dzi file url :
         *      tileSources: url
         *  -   For a jpeg file url :
         *      { type: 'image', url: url }
         */

        if (this.DEBUGImage) {
            data.tileSources = {
                Image: {
                    xmlns: 'https://schemas.microsoft.com/deepzoom/2008',
                    Url: '//openseadragon.github.io/example-images/duomo/duomo_files/',
                    Format: 'jpg',
                    Overlap: '2',
                    TileSize: '256',
                    Size: {
                        Width:  '13920',
                        Height: '10200',
                    },
                },
            };
            data.prefixUrl = '//openseadragon.github.io/openseadragon/images/';
        }

        return new Promise((resolve) => {
            this.viewer = OpenSeadragon(data);
            const subjectZoom: Subject<any> = new Subject();
            this.viewer.addHandler('zoom', (e: any) => {
                subjectZoom.next(e);
            });
            subjectZoom.pipe(debounceTime(50)).subscribe(() => {
                this.calculateRatio();
                this.resetStrokeWidth();
            });

            this.viewer.addOnceHandler('open', () => {
                this.calculateRatio();
                resolve(this);
            });

            this.viewer.addHandler('canvas-drag', (event) => {
                if (this.drawOptions?.isDrawing) {
                    event.preventDefaultAction = true;
                }
            });

            const subjectResize: Subject<any> = new Subject();
            this.viewer.addHandler('resize', (e: any) => {
                subjectResize.next(e);
            });
            subjectResize.pipe(debounceTime(200)).subscribe(() => {
                this.goHome();
            });

        });
    }

    /**
     * Delete all subscribers canvas and player.
     */
    public delete() : AnnotationOSDService {
        this.objectActions.emit({ type : 'clearCanvas', object : undefined });
        this.canvas.clear();
        this.canvas.dispose();
        this.canvas.removeListeners();
        this.viewer.destroy();
        return this;
    }

    /**
     * Clear canvas.
     */
    public clear() : AnnotationOSDService {
        this.objectActions.emit({ type : 'clearCanvas', object : undefined });
        this.canvas.clear();
        return this;
    }

    /**
     * Delete object inside canvas.
     * @param id
     */
    public deleteMarker(id : string) : AnnotationOSDService {
        if (this.checkIfMarkerExist(id)) {
            let obj = this.canvas.getObjects().filter((o: any) => o.id === id);
            this.objectActions.emit({ type : 'deleteMarker', object: this.objectToMarker(obj[0]) });
            this.canvas.remove(obj[0]);
            this.canvas.renderAll();
        }
        return this;
    }

    /**
     * Lock object inside canvas moving
     * @param o
     * @param lock
     * @private
     */
    private lockObject(o : fabric.Object, lock = true) {
        o.lockMovementX = lock;
        o.lockMovementY = lock;
    }

    /**
     * Lock all objeck moving
     * @param lock
     * @private
     */
    private lockAllObject(lock = true) {
        this.canvas.getObjects().map(o => this.lockObject(o, lock));
    }

    /**
     * Add fabric canvas over viewport
     * @param dotRadius
     * @param strokeWidth
     */
    public addCanvas(dotRadius ?: number, strokeWidth ?: number) : AnnotationOSDService {
        if (dotRadius) this.dotRadius =  dotRadius;
        if (strokeWidth) this.strokeWidth =  strokeWidth;
        this.canvas = (this.viewer as any)
            .fabricjsOverlay({ scale: this.imageWidth })
            .fabricCanvas({
                objectCaching : false,
                imageSmoothingEnabled: false, // here you go
                fireRightClick: true,  // <-- enable firing of right click events
                fireMiddleClick: true, // <-- enable firing of middle click events
                stopContextMenu: true, // <--  prevent context menu from showing
            });
        fabric.Object.prototype.objectCaching = false; // no cache on canvas
        fabric.Object.prototype.strokeUniform = true; // border keep size
        fabric.Object.prototype.noScaleCache = false; // scale no blur
        this.canvas.hoverCursor = 'pointer';
        this.canvas.moveCursor = 'Handwriting';
        this.canvas.hoverCursor = 'pointer';

        this.canvasEvents();
        return this;
    }

    /**
     * Canvas events mouse over etc...
     * @private
     */
    private canvasEvents() {
        this.canvas.on('mouse:over', (e) => {
            if (this.drawOptions?.isDrawing) return;
            if (e.target  ) {
                if ((e.target as any).id !== this.getSelectedObjectId())
                    this.objectSetStyle(e.target, (e.target as any).style.hover);
                this.objectActions.emit({ type : 'mouse:over', object: this.objectToMarker(e.target) });
            }
            this.canvas.renderAll();
        });

        this.canvas.on('after:render', () => {
            this.resetStrokeWidth();
        });

        this.canvas.on('mouse:out', (e)  => {
            if (this.drawOptions?.isDrawing) return;
            if (e.target  ) {
                if ((e.target as any).id !== this.getSelectedObjectId())
                    this.objectSetStyle(e.target, (e.target as any).style.neutral);
                this.objectActions.emit({ type : 'mouse:out',  object: this.objectToMarker(e.target) });
            }
            this.canvas.renderAll();
        });

        this.canvas.on('object:scaling', (e) => {
            if (this.drawOptions?.isDrawing) return;
            if (e.transform?.target) {
                this.objectScaling(e);
                this.objectMoving(e);
                this.objectSetStyle(e.transform?.target, (e.transform?.target as any).style.active);
                this.objectActions.emit({ type : 'object:scaling',
                    action : e.transform?.action,
                    object: this.objectToMarker(e.target) });
            }
            this.canvas.renderAll();
        });

        this.canvas.on('before:transform', () => {
            if (this.drawOptions?.isDrawing) this.canvas.discardActiveObject().renderAll();
        });

        this.canvas.on('selection:created', (e) => {
            if (this.drawOptions?.isDrawing) return;
            if (e.selected) {
                this.objectSetStyle(e.selected[0], (e.selected[0] as any).style.active);
                this.objectActions.emit({ type : 'selection:created', object: this.objectToMarker(e.selected[0])  });
            }
            this.canvas.renderAll();
        });

        this.canvas.on('selection:updated', (e) => {
            if (this.drawOptions?.isDrawing) return;
            if (e.deselected) {
                this.objectSetStyle(e.deselected[0], (e.deselected[0] as any).style.neutral);
                this.objectActions.emit({ type : 'selection:updated:deselected',  object: this.objectToMarker(e.deselected[0])  });
            }
            if (e.selected) {
                this.objectSetStyle(e.selected[0], (e.selected[0] as any).style.active);
                this.objectActions.emit({ type : 'selection:updated:selected',  object: this.objectToMarker(e.selected[0]) });
            }
            this.canvas.renderAll();
        });

        this.canvas.on('before:selection:cleared', (e) => {
            if (this.drawOptions?.isDrawing) return;
            if (e.target) {
                this.objectSetStyle(e.target, (e.target as any).style.neutral);
                this.objectActions.emit({ type : 'selection:cleared',  object: this.objectToMarker(e.target) });
            }
            this.canvas.renderAll();
        });

        this.canvas.on('object:moving', (e)=>{
            this.objectMoving(e);
        });

        this.canvas.on('object:modified', (e) => {
            if (this.drawOptions?.isDrawing) return;
            if (e.target) {
                if (e.target.type === 'MarkerPoly') {
                    this.setPolygonRealPoints(e.target);
                }
                this.objectActions.emit({ type : 'object:modified',
                    action : e.transform?.action,
                    object: this.objectToMarker(e.target)  });
                this.canvas.renderAll();
            }
        });

        this.canvas.on('mouse:down', (o) => {
            this.newDraw(o);
            this.validateDraw();
        });

        this.canvas.on('mouse:move', (o) => {
            this.moveDraw(o.e);
        });

        this.canvas.on('mouse:up', (o) => {
            this.validateDraw();
        });

        this.canvas.on('mouse:move', (options) => {
            this.drawPolygonLines(options);
        });
    }

    /**
     * Set Polygon real Points
     * @param e
     * @private
     */
    private setPolygonRealPoints(obj : any) {
        let matrix = obj.calcTransformMatrix();
        let points = (obj as any).get('points')
            .map((p : any) => {
                return new fabric.Point(
                    p.x - (obj as any).pathOffset.x,
                    p.y - (obj as any).pathOffset.y);
            })
            .map((p : any) => {
                return fabric.util.transformPoint(p, matrix);
            });
        (obj as any).set('realPoints', points);
    }

    /**
     * Set style to object private methode
     * @param object
     * @param style
     * @private
     */
    private objectSetStyle(object : any, style : FabricStyle) {
        object.set('fill', style.fill);
        object.set('cornerColor', style.cornerColor);
        object.set('stroke', style.stroke);
        object.set('opacity', style.opacity);
    }

    /**
     * Auto reset the size of fabric elements when user zoom on canvas, or page resize.
     * @private
     */
    private resetStrokeWidth()  {
        if (this.canvas) {
            const strokeWidth = this.strokeWidth / this.canvas.getZoom();
            for (const object of this.canvas.getObjects()) {
                // @ts-ignore
                if (object.get('type') !== 'MarkerPolyDot' && object.get('type') !== 'MarkerPolyTmp'  ) {
                    object.set('strokeWidth', strokeWidth);
                }
                // @ts-ignore
                if (object.get('radius') && object.get('type') === 'MarkerPolyDot') {
                    // @ts-ignore
                    object.set('radius', this.dotRadius / this.canvas.getZoom());
                }
                // can also update other things here
            }
        }
    }

    /**
     * Check of a marker exist inside canvas
     * @param id
      */
    public checkIfMarkerExist(id : string) {
        const objectList = this.canvas.getObjects();
        let index = objectList.findIndex((o : any) => {return  o.id === id;});
        return index !== -1;
    }

    /**
     * Calculate ratio of canvas when user load image or resize page.
     * @private
     */
    private calculateRatio() {
        this.imageWidth = (this.viewer as any).source.dimensions.x;
        this.imageHeight = (this.viewer as any).source.dimensions.y;
        this.containerWidth = this.viewer.viewport.getContainerSize().x;
        this.containerHeight = this.viewer.viewport.getContainerSize().y;
        this.zoomToZoomLevelRatio = this.containerWidth / this.imageWidth;
        this.scale = this.viewer.viewport.getZoom(true) * this.zoomToZoomLevelRatio;
    }

    /**
     * Center canvas inside viewport or go to home point if exist.
     */
    public goHome() : AnnotationOSDService {
        if (this.home) {
            // // Calculate zoom
            let viewer = this.viewer.viewport.getContainerSize();
            let boxHeight =  this.home.height;
            let boxWidth = this.home.width;

            let h = viewer.y / boxHeight;
            let w =  viewer.x / boxWidth;

            let zoomImage =  h > w ? w : h;
            let zoom = this.viewer.viewport.imageToViewportZoom( zoomImage);
            this.viewer.viewport.zoomTo(zoom);

            // Go to zoom point
            let refPoint = new OpenSeadragon.Point(this.home.point.x * this.imageWidth, this.home.point.y * this.imageHeight);
            let realPoint = this.viewer.viewport.imageToViewerElementCoordinates(refPoint);
            let viewerPoint = this.viewer.viewport.viewerElementToViewportCoordinates(realPoint);
            this.viewer.viewport.panTo(viewerPoint);
        } else {
            this.viewer.viewport.goHome(false);
        }
        return this;
    }

    /**
     * Set home point.
     * @param roi Region of interest in percent, center point.
     */
    public setHome(roi : RegionOfInterest, goHome = false) : AnnotationOSDService {
        if ((roi.point.x > 1 || roi.point.y > 1 || roi.width > 1 || roi.height > 1) && roi.unit === 'percent')
            throw new Error('Data size is not percent');

        if (roi.unit === 'percent') {
            roi.height *= this.imageHeight;
            roi.width *= this.imageWidth;
        } else {
            roi.point.x /= this.imageWidth;
            roi.point.y /= this.imageHeight;
        }
        this.home = roi;
        if (goHome) this.goHome();
        return this;
    }

    /**
     * Set home point from marker id
     * @param id
     */
    public setHomePointMarker(id : string, goHome = false) {
        let obj = this.getObjectById(id);
        let margin = 50; // margin in pixel
        this.home = { point : {
            x : obj.getCenterPoint().x / this.imageWidth,
            y : obj.getCenterPoint().y / this.imageHeight,
        },
        width : obj.width + margin, height : obj.height + margin, unit : 'pixel' };
        if (goHome) this.goHome();
        return this;
    }

    /**
     * Unset home
     * @param goHome
     */
    public unsetHome(goHome = false) {
        this.home = undefined;
        if (goHome) this.goHome();
    }

    /**
     * Add markers inside canvas
     * @param marker
     */
    public addMarker(marker : MarkerRound | MarkerRect | MarkerPoly) : AnnotationOSDService {
        if (this.checkIfMarkerExist(marker.id))
            throw new Error(`Marker ${marker.id} already exist inside canvas`);
        if (marker.type ===  'MarkerRound') this.addMarkerRound(marker as MarkerRound);
        if (marker.type ===  'MarkerRect') this.addMarkerRect(marker as MarkerRect);
        if (marker.type ===  'MarkerPoly') this.addMarkerPoly(marker as MarkerPoly);
        return this;
    }

    /**
     * Get fabric object by id
     * @param id
     * @private
     */
    private getObjectById(id : string) : any {
        const objectList = this.canvas.getObjects();
        let index = objectList.findIndex((o : any) => {return  o.id === id;});
        if (index !== -1) return objectList[index];
        return undefined;
    }

    /**
     * Add marker poly inside canvas
     * @param marker
     * @private
     */
    private addMarkerPoly(marker : MarkerPoly) {
        if (marker.unit === 'percent') {
            marker.dots.forEach(dot => {
                dot.y *= this.imageHeight;
                dot.x *= this.imageWidth;
            });
        }

        const obj = new fabric.Polygon(marker.dots, {
            id: marker.id,
            type : 'MarkerPoly',
            unit : marker.unit,
            strokeWidth: this.strokeWidth / this.canvas.getZoom(),
            strokeDashArray: undefined,
            ...marker.options.style.neutral,
            ...marker.options,
        } as fabric.IPolylineOptions);

        if (this.objectInside(obj) === false)
            throw new Error(`Object ${(obj as any).id} is not inside image`);

        this.canvas.add(obj);
        obj.saveState();
        this.editPolygon(obj);
    }

    /**
     * Add marker rect inside canvas
     * @param marker
     * @private
     */
    private addMarkerRect(marker : MarkerRect) {
        let  obj, left, top, width, height;
        left = marker.centerX;
        top = marker.centerY; 
        width = marker.width ;
        height = marker.height;
        if (marker.unit === 'percent') {
            left *= this.imageWidth;
            top *=  this.imageHeight;
            width *=  this.imageWidth;
            height *= this.imageHeight;
        }
        obj = new fabric.Rect({
            id: marker.id,
            left, top, width, height,
            strokeWidth:  this.strokeWidth / this.canvas.getZoom(),
            strokeDashArray: undefined,
            unit : marker.unit,
            originX: 'center',
            originY: 'center',
            cornerStyle: 'circle',
            type : 'MarkerRect',
            ...marker.options.style.neutral,
            ...marker.options,
        } as fabric.IRectOptions);
        // @ts-ignore
        obj.setControlsVisibility({ mtr: false });
        if (this.objectInside(obj) === false)
            throw new Error(`Object ${(obj as any).id} is not inside image`);
        obj.saveState();
        this.canvas.add(obj);
    }

    /**
     * Transform fabric object to marker.
     * @param e
     * @private
     */
    private objectToMarker(e : any) : MarkerRound | MarkerRect | MarkerPoly   {
        let options = {
            style : e.style,
            selectable: e.selectable,
            hasBorders: e.hasBorders,
            transparentCorners: e.transparentCorners,
            draggable: e.draggable,
            lockRotation: e.lockRotation,
            hasControls: e.hasControls,
            perPixelTargetFind : e.perPixelTargetFind,
        };

        let unit = e.unit;
        let centerX, centerY, width, height;
        centerX = e.getCenterPoint().x;
        centerY = e.getCenterPoint().y;
        width = e.width;
        height = e.height;
        if (unit === 'percent') {
            centerX /= this.imageWidth;
            centerY /= this.imageHeight;
            width /= this.imageWidth;
            height /= this.imageHeight;
        }
        if (e.type === 'MarkerRound') return new MarkerRound(e.id, options, centerX, centerY, width, unit);
        else  if (e.type === 'MarkerRect') return new MarkerRect(e.id, options, centerX, centerY, width, height, unit);
        else  {
            // Web/API/structuredClone - moz://a 2022
            // @ts-ignore
            let dots: Point[] = structuredClone(e.get('realPoints') ? e.get('realPoints') : e.get('points'));
            if (e.unit === 'percent') {
                dots.map(dot => {
                    dot.x = dot.x / this.imageWidth;
                    dot.y = dot.y / this.imageHeight;
                });
            }
            return new MarkerPoly(e.id, options, dots, unit);
        }
    }

    /**
     * Add marker round inside canvas
     * @param marker
     * @private
     */
    private addMarkerRound(marker : MarkerRound) {
        let width, left, top;
        left = marker.centerX;
        top = marker.centerY;
        width = marker.width ;
        if (marker.unit === 'percent') {
            left *= this.imageWidth ;
            top *= this.imageHeight;
            width *= this.imageWidth ;
        }
        let obj = new fabric.Circle({
            id: marker.id,
            left,
            top,
            radius : width / 2,
            strokeWidth: this.strokeWidth / this.canvas.getZoom(),
            strokeDashArray: undefined,
            unit : marker.unit,
            originX: 'center',
            originY: 'center',
            cornerStyle: 'circle',
            type : 'MarkerRound',
            ...marker.options.style.neutral,
            ...marker.options,
        } as fabric.ICircleOptions);
        obj.saveState();
        obj.setControlsVisibility({ mtr: false, mb : false, mt :false, mr : false, ml : false  });
        if (this.objectInside(obj) === false)
            throw new Error(`Object ${(obj as any).id} is not inside image`);
        obj.saveState();
        this.canvas.add(obj);
    }

    /**
     * Return the current selected object if there is one.
     */
    public getSelectedObjectId()  : string {
        let target = this?.canvas?.getActiveObject();
        return (target as any)?.id;
    }

    /**
     * Set draw mode
     * @param drawOptions
     */
    public setDrawMode(drawOptions : DrawOptions) : AnnotationOSDService {
        // @ts-ignore
        this.drawOptions =  structuredClone(drawOptions);
        if (this.drawOptions.isDrawing && !this.drawOptions.data.id)
            throw new Error('Need Id for draw new marker');
        if (this.checkIfMarkerExist(this.drawOptions.data.id))
            throw new Error(`Marker ${this.drawOptions.data.id} already exist`);
        if (this.drawOptions.type === 'MarkerPoly') this.drawPolygonInit();
        this.lockAllObject(drawOptions.isDrawing);
        return this;
    }

    /**
     * Get is drawing
     */
    public isDrawing() {
        return !!this.drawOptions.isDrawing;
    }

    /**
     * Cancel draw
     */
    public cancelDrawMode() : AnnotationOSDService {
        this.deleteMarker(this.drawOptions.data.id);
        this.deleteTmpPoly();
        // @ts-ignore
        this.drawOptions =  { isDrawing : false };
        return this;
    }

    /**
     * Init draw polygon data values
     * @private
     */
    private drawPolygonInit() {
        this.drawOptions.data.min = 9;
        this.drawOptions.data.max = 99;
        this.drawOptions.data.polygonMode = true;
        this.drawOptions.data.pointArray = [];
        this.drawOptions.data.lineArray = [];
        this.drawOptions.data.activeLine;
    }

    /**
     * Move draw
     * @param e
     * @private
     */
    private moveDraw(e : any) {
        if (!this.drawOptions.isDrawing || !this.drawOptions?.data?.objTmp ) return;
        let pointer = this.canvas.getPointer(e);
        // if (!this.pointInside(pointer)) return;
        if (this.drawOptions.type === 'MarkerRect') {
            let tmp =  { ...this.drawOptions.data.objTmp };
            if (this.drawOptions.data.origX > pointer.x)
                tmp.left = pointer.x;
            if (this.drawOptions.data.origY > pointer.y)
                tmp.top = pointer.y;

            tmp.width = Math.abs(this.drawOptions.data.origX - pointer.x);
            tmp.height = Math.abs(this.drawOptions.data.origY - pointer.y);
            if (this.objectInside(tmp)) {
                this.drawOptions.data.objTmp.set(tmp);
            }
            
        } else if (this.drawOptions.type === 'MarkerRound') {
            let x = pointer.x > this.drawOptions.data.origX ?
                pointer.x - this.drawOptions.data.origX : this.drawOptions.data.origX - pointer.x;
            let y = pointer.y > this.drawOptions.data.origY ?
                pointer.y - this.drawOptions.data.origY : this.drawOptions.data.origY - pointer.y;
            let radius = x > y ? x : y;
            radius = radius > 3 / this.canvas.getZoom() ? radius : 3 / this.canvas.getZoom();
            let tmp = { ...this.drawOptions.data.objTmp };
            tmp.radius = radius;
            tmp.width = radius * 2;
            tmp.height = radius * 2;
            if (this.objectInside(tmp)) this.drawOptions.data.objTmp.set({ radius, width : radius * 2, height : radius * 2 });
        }
        this.canvas.renderAll();
    }

    /**
     * New draw
     * @param e
     * @private
     */
    private newDraw(o : any) {
        if (!this.drawOptions.isDrawing || this.drawOptions.data.objTmp) return;
        let pointer = this.canvas.getPointer(o.e);
        if (!this.pointInside(pointer)) return;
        if (this.drawOptions.type === 'MarkerRect') this.drawMarkerRect(pointer);
        else if (this.drawOptions.type === 'MarkerRound') this.drawMarkerRound(pointer);
        else if (this.drawOptions.type === 'MarkerPoly') this.drawMarkerPoly(o);
    }

    /**
     * Add new dot marker poly
     * @param o
     * @private
     */
    private drawMarkerPoly(o  : any) {
        if (o.target &&  this.drawOptions?.data?.pointArray.length > 2
            &&  this.drawOptions?.data?.pointArray[0] &&  o?.target.id === this.drawOptions.data.pointArray[0].id) {
            this.generatePolygon(this.drawOptions.data.pointArray);
            this.validateDraw();
        } else if (this.drawOptions.data.polygonMode) {
            if (!this.drawOptions.data.pointArray[0]
                ||  (this.drawOptions.data.pointArray[0] && o?.target?.id !== this.drawOptions.data.pointArray[0].id))
                this.addPointPoly(o);
        }
    }

    /**
     * Draw new marker rect
     * @param pointer
     * @private
     */
    private drawMarkerRect(pointer : Point) {
        this.drawOptions.data.origX = pointer.x;
        this.drawOptions.data.origY = pointer.y;
        this.drawOptions.data.objTmp = new fabric.Rect({
            left: this.drawOptions.data.origX,
            top: this.drawOptions.data.origY,
            width: pointer.x - this.drawOptions.data.origX,
            height: pointer.y - this.drawOptions.data.origY,
            id: this.drawOptions.data.id,
            strokeWidth: this.strokeWidth,
            strokeDashArray: undefined,
            unit: this.drawOptions.unit,
            originX: 'left',
            originY: 'top',
            cornerStyle: 'circle',
            type: 'MarkerRect',
            ...this.drawOptions.options.style.active,
            ...this.drawOptions.options,
        } as fabric.IRectOptions);
        this.drawOptions.data.objTmp.setControlsVisibility({ mtr: false });
        this.canvas.add(this.drawOptions.data.objTmp);
    }

    /**
     * Delete tmp of polygon drawing
     * @private
     */
    private deleteTmpPoly() {
        const objectList = this.canvas.getObjects();
        objectList.map(obj => {
            if (obj.type === 'MarkerPolyTmp' || obj.type === 'MarkerPolyLine' || obj.type === 'MarkerPolyDot') {
                this.canvas.remove(obj);
            }
        });
        this.canvas.renderAll();
    }

    /**
     * Draw new marker round
     * @param pointer
     * @private
     */
    private drawMarkerRound(pointer : Point) {
        this.drawOptions.data.origX = pointer.x;
        this.drawOptions.data.origY = pointer.y;
        this.drawOptions.data.objTmp = new fabric.Circle({
            left: this.drawOptions.data.origX,
            top: this.drawOptions.data.origY,
            id: this.drawOptions.data.id,
            strokeWidth: this.strokeWidth / this.canvas.getZoom(),
            strokeDashArray: undefined,
            unit: this.drawOptions.unit,
            originX: 'center',
            originY: 'center',
            cornerStyle: 'circle',
            type: 'MarkerRound',
            ...this.drawOptions.options.style.active,
            ...this.drawOptions.options,
        } as fabric.ICircleOptions);
        this.drawOptions.data.objTmp.setControlsVisibility({ mtr: false, mb : false, mt :false, mr : false, ml : false  });
        this.canvas.add(this.drawOptions.data.objTmp);
    }

    /**
     * Validate Drawing of new damage
     * @private
     */
    private validateDraw() {
        if ( !this.drawOptions.isDrawing || !this.drawOptions.data.objTmp  ) return;
        if (this.drawOptions.type !== 'MarkerPoly'
            && (this.drawOptions.data.objTmp.width === 0 || this.drawOptions.data.objTmp.height === 0) ) return;
        if (this.drawOptions.type === 'MarkerRect') {
            this.drawOptions.data.objTmp.set('left', this.drawOptions.data.objTmp.getCenterPoint().x);
            this.drawOptions.data.objTmp.set('top', this.drawOptions.data.objTmp.getCenterPoint().y);
            this.drawOptions.data.objTmp.set('originX', 'center');
            this.drawOptions.data.objTmp.set('originY', 'center');
        }
        this.drawOptions.data.objTmp.setCoords();
        this.objectSetStyle(this.drawOptions.data.objTmp, (this.drawOptions.data.objTmp as any).style.neutral);
        this.drawOptions.isDrawing = false;
        this.lockAllObject(this.drawOptions.isDrawing);
        this.canvas.renderAll();
        this.objectActions.emit({ type : 'createMarker', object: this.objectToMarker(this.drawOptions.data.objTmp) });
    }

    /**
     * Add polygon point
     * @param options
     * @private
     */
    private addPointPoly(options : any) {
        const random = Math.floor(Math.random() * (this.drawOptions.data.max - this.drawOptions.data.min + 1)) + this.drawOptions.data.min;
        const id = new Date().getTime() + random;
        const  pos = this.canvas.getPointer(options.e);
        const circle = new fabric.Circle({
            radius: this.dotRadius / this.canvas.getZoom().valueOf(),
            strokeWidth: 0,
            ...this.drawOptions.options.style.neutral,
            fill: this.drawOptions.options.style.neutral.cornerColor,
            left: pos.x,
            top: pos.y,
            selectable: false,
            hasBorders: false,
            type : 'MarkerPolyDot',
            hasControls: false,
            originX: 'center',
            originY: 'center',
            id,
            objectCaching: false,
        } as fabric.ICircleOptions);

        if (this.drawOptions.data.pointArray.length === 0)
            circle.set({ fill: this.drawOptions.options.style.active.cornerColor });

        let pointsA = [pos.x, pos.y, pos.x, pos.y];

        if (this.drawOptions.data.activeShape  ) {
            const pointsB = this.drawOptions.data.activeShape.get('points') as any[];
            let lastPoint = pointsB[pointsB.length - 1];
            pointsA = [lastPoint.x, lastPoint.y, pos.x, pos.y];
            pointsB.push({
                x: pos.x,
                y: pos.y,
            });
            const polygonA = new fabric.Polygon(pointsB, {
                ...this.drawOptions.options.style.neutral,
                stroke: '#333333',
                strokeWidth:0,
                fill: '#cccccc',
                opacity: 0.3,
                selectable: false,
                hasBorders: false,
                hasControls: false,
                type : 'MarkerPolyTmp',
                evented: false,
                objectCaching: false,
            });
            this.canvas.remove(this.drawOptions.data.activeShape);
            this.canvas.add(polygonA);
            this.drawOptions.data.activeShape = polygonA;
            this.canvas.renderAll();
        } else {
            const polyPoint = [{ x: pos.x, y: pos.y }];
            const polygon = new fabric.Polygon(polyPoint, {
                ...this.drawOptions.options.style.neutral,
                stroke: '#333333',
                strokeWidth:0,
                opacity: 0.3,
                selectable: false,
                hasBorders: false,
                type : 'MarkerPolyTmp',
                hasControls: false,
                evented: false,
                objectCaching: false,
            });
            this.drawOptions.data.activeShape = polygon;
            this.canvas.add(polygon);
        }

        const line = new fabric.Line(pointsA, {
            ...this.drawOptions.options.style.hover,
            strokeWidth: this.strokeWidth / this.canvas.getZoom(),
            class: 'line',
            type : 'MarkerPolyLine',
            originX: 'center',
            originY: 'center',
            selectable: false,
            hasBorders: false,
            hasControls: false,
            evented: false,
            objectCaching: false,
        } as fabric.ILineOptions);

        this.drawOptions.data.activeLine = line;
        this.drawOptions.data.pointArray.push(circle);
        this.drawOptions.data.lineArray.push(line);
        this.canvas.add(line);
        this.canvas.add(circle);
        this.bringMarkerPolyFront();
    }


    private drawPolygonLines(options : fabric.IEvent) {
        if (this.drawOptions.isDrawing && this.drawOptions.data.activeLine && this.drawOptions.data.activeLine.class === 'line') {

            if (window.matchMedia('(pointer: coarse)').matches) return; // Prevent bug polyLineTmp on touch devices

            const pointer = this.canvas.getPointer(options.e);
            this.drawOptions.data.activeLine.set({ x2: pointer.x, y2: pointer.y });

            const points = this.drawOptions.data.activeShape.get('points');
            points[this.drawOptions.data.pointArray.length] = {
                x: pointer.x,
                y: pointer.y,
            };
            this.drawOptions.data.activeShape.set({
                points,
            });
            this.canvas.renderAll();
        }
        this.canvas.renderAll();
    }

    /**
     * Function to bring marker poly dot front during update or drawing
     * @private
     */
    private bringMarkerPolyFront(obj ?: any) {
        if (obj && obj.type !== 'MarkerPoly') return;
        this.canvas.getObjects().filter((o:any) => o.type === 'MarkerPolyDot' || o.type === 'MarkerPolyLine').map((o:any) => {
            if (o.type === 'MarkerPolyDot')
                o.bringToFront();
            o.setCoords();
        });
    }

    /**
     * Generate polygon after drawing i
     * @param pointArray
     * @private
     */
    private generatePolygon(pointArray : any) {
        // @ts-ignore
        const points = [];
        // @ts-ignore
        pointArray.forEach((point) => {
            points.push({
                x: point.left,
                y: point.top,
            });
            this.canvas.remove(point);
        });
        // @ts-ignore
        this.drawOptions.data.lineArray.forEach((line) => {
            this.canvas.remove(line);
        });
        this.canvas.remove(this.drawOptions.data.activeShape).remove(this.drawOptions.data.activeLine);
        // @ts-ignore
        this.drawOptions.data.objTmp = new fabric.Polygon(points, {
            unit : this.drawOptions.unit,
            id : this.drawOptions.data.id,
            type : 'MarkerPoly',
            strokeWidth: this.strokeWidth / this.canvas.getZoom(),
            strokeDashArray: undefined,
            objectCaching: false,
            ...this.drawOptions.options.style.neutral,
            ...this.drawOptions.options,
        } as fabric.IPolylineOptions);
        this.canvas.add(this.drawOptions.data.objTmp);
        this.drawOptions.data.objTmp.setCoords();
        this.editPolygon(this.drawOptions.data.objTmp);
        this.drawOptions.data.activeLine = null;
        this.drawOptions.data.activeShape = null;
        this.drawOptions.data.polygonMode = false;
    }

    /// Fabric JS Controls for Polygon \\\

    /**
     * Edit Polygon param options
     * @param polygon
     * @private
     */
    // @ts-ignore
    private editPolygon(polygon) {
        polygon.edit = true;
        polygon.hasBorders = false;

        let lastControl = polygon.points.length - 1;
        polygon.cornerStyle = 'circle';
        polygon.cornerColor = 'rgba(0,0,255,0.5)';
        // @ts-ignore
        polygon.controls = polygon.points.reduce( (acc, point, index) => {
            acc['p' + index] = new fabric.Control({
                positionHandler: this.polygonPositionHandler,
                actionHandler: this.anchorWrapper(
                    index > 0 ? index - 1 : lastControl,
                    this.actionHandler,
                    this,
                ),
                actionName: 'modifyPolygon',
                // @ts-ignore
                pointIndex: index,
            });
            return acc;
        }, {});

        this.canvas.requestRenderAll();
    }

    /**
     * define a function that can locate the controls.
     * this function will be used both for drawing and for interaction.
     * @param dim
     * @param finalMatrix
     * @param fabricObject
     * @private
     */
    // @ts-ignore
    private polygonPositionHandler(dim, finalMatrix, fabricObject) {
        // @ts-ignore
        let x = fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x,
            // @ts-ignore
            y = fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y;
        // @ts-ignore
        return fabric.util.transformPoint({
            x: x,
            y: y,
        },
        fabric.util.multiplyTransformMatrices(
            fabricObject.canvas.viewportTransform,
            fabricObject.calcTransformMatrix(),
        ),
        );
    }

    /**
     * define a function that will define what the control does
     * this function will be called on every mouse move after a control has been
     * clicked and is being dragged.
     * The function receive as argument the mouse event, the current trasnform object
     * and the current position in canvas coordinate
     * transform.target is a reference to the current object being transformed,
     * @param eventData
     * @param transform
     * @param x
     * @param y
     * @private
     */
    // @ts-ignore
    private actionHandler(eventData, transform, x, y, ctx) {
        // @ts-ignore
        if (ctx.pointInside({ x, y }) === false) return false;

        let polygon = transform.target,
            currentControl = polygon.controls[polygon.__corner],
            mouseLocalPosition = polygon.toLocalPoint(
                new fabric.Point(x, y),
                'center',
                'center',
            ),
            polygonBaseSize = polygon._getNonTransformedDimensions(),
            size = polygon._getTransformedDimensions(0, 0),
            finalPointPosition = {
                x: (mouseLocalPosition.x * polygonBaseSize.x) / size.x +
                    polygon.pathOffset.x,
                y: (mouseLocalPosition.y * polygonBaseSize.y) / size.y +
                    polygon.pathOffset.y,
            };
        polygon.points[currentControl.pointIndex] = finalPointPosition;
        return true;
    }

    /**
     * Define a function that can keep the polygon in the same position when we change its
     * @param anchorIndex
     * @param fn
     * @private
     */
    // @ts-ignore
    private anchorWrapper(anchorIndex, fn, ctx) {
        // @ts-ignore
        return function (eventData, transform, x, y) {
            let fabricObject = transform.target,
                absolutePoint = fabric.util.transformPoint(
                    // @ts-ignore
                    {
                        x: fabricObject.points[anchorIndex].x -
                            fabricObject.pathOffset.x,
                        y: fabricObject.points[anchorIndex].y -
                            fabricObject.pathOffset.y,
                    },
                    fabricObject.calcTransformMatrix(),
                ),
                actionPerformed = fn(eventData, transform, x, y, ctx),
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                newDim = fabricObject._setPositionDimensions({}),
                polygonBaseSize = fabricObject._getNonTransformedDimensions(),
                newX =
                    (fabricObject.points[anchorIndex].x -
                        fabricObject.pathOffset.x) /
                    polygonBaseSize.x,
                newY =
                    (fabricObject.points[anchorIndex].y -
                        fabricObject.pathOffset.y) /
                    polygonBaseSize.y;
            fabricObject.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5);
            return actionPerformed;
        };
    }

}