export type PlayerType = 'image' | 'dzi';
export type UnitType = 'percent' | 'pixel';
export type MarkersType = 'MarkerRound' | 'MarkerPoly' | 'MarkerRect';
export type EventObjectType =
    'clearCanvas'
    | 'createMarker'
    | 'deleteMarker'
    | 'mouse:over'
    | 'mouse:out'
    | 'object:scaling'
    | 'selection:created'
    | 'selection:updated:deselected'
    | 'selection:updated:selected'
    | 'selection:cleared'
    | 'object:modified';
export interface Point {x : number, y : number}

export interface RegionOfInterest {
    point : Point,
    width : number,
    height : number,
    unit : UnitType
}

export interface DrawOptions {
    isDrawing : boolean,
    options : FabricOptions,
    unit : UnitType,
    type : MarkersType,
    data : any
}

abstract class AnnotateMarker {
    readonly id : string;
    readonly unit : UnitType;
    readonly centerY : number;
    readonly centerX : number;
    readonly width : number;
    readonly height : number;
    readonly type : string;
    readonly options : FabricOptions;

    protected constructor(id: string, options : FabricOptions, unit: UnitType, centerX: number,
        centerY: number, width: number, height: number, type: string) {
        if (unit === 'percent' && (centerX > 1 || centerY > 1 || width > 1 || height > 1))
            throw new Error('AnnotateMarker unit is percent but value > 1');
        if (centerX < 0 || centerY < 0 || width < 0 || height < 0)
            throw new Error('AnnotateMarker value < 0');
        this.id = id;
        // Web/API/structuredClone - moz://a 2022
        // @ts-ignore
        this.options = structuredClone(options);
        this.unit = unit;
        this.centerY = centerY;
        this.centerX = centerX;
        this.width = width;
        this.height = height;
        this.type = type;
    }
}

export class MarkerRect extends AnnotateMarker {
    constructor(id: string, options : FabricOptions, centerX: number,
        centerY: number, width: number, height: number, unit: UnitType = 'percent') {
        const type = 'MarkerRect';
        super(id, options, unit, centerX, centerY, width, height, type);
    }
}

export class MarkerRound extends AnnotateMarker {
    constructor(id: string, options : FabricOptions, centerX: number,
        centerY: number, width: number, unit: UnitType = 'percent') {
        const type = 'MarkerRound';
        super(id,  options, unit, centerX, centerY, width, width, type);
    }
}

export  class MarkerPoly {
    readonly  type = 'MarkerPoly';
    readonly unit: UnitType;
    readonly dots: Point[];
    readonly id : string;
    readonly options : FabricOptions;
    constructor(id :string, options : FabricOptions, dots: Point[], unit: UnitType = 'percent') {
        dots.forEach(dot => {
            if (unit === 'percent' && (dot.x > 1 || dot.y > 1))
                throw new Error('AnnotateMarker unit is percent but value > 1');
            if (dot.x  < 0 || dot.y < 0)
                throw new Error('AnnotateMarker value < 0');
        });
        this.unit = unit;
        this.dots = dots;
        this.id = id;
        // @ts-ignore
        this.options = structuredClone(options);
    }
}

export interface FabricStyle {
    fill:string,
    stroke: string,
    cornerColor: string,
    opacity : number,
}

export interface FabricOptions {
    selectable: boolean,
    hasBorders: boolean,
    transparentCorners: boolean,
    draggable: boolean,
    lockRotation: boolean,
    hasControls: boolean,
    style : {
        neutral  :FabricStyle,
        hover : FabricStyle,
        active : FabricStyle
    }
}

