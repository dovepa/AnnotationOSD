// eslint-disable-next-line import/named
import { Component, OnInit } from '@angular/core';
import { AnnotationOSDService } from '../../../annotation-osd/src/lib/annotation-osd.service';
import {
    MarkerPoly,
    MarkerRect,
    MarkerRound, MarkersType,
} from '../../../annotation-osd/src/lib/annotation-osd.model';
import { uid } from 'uid';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
    player : AnnotationOSDService;
    options = {
        style : {
            hover : {
                fill: 'transparent',
                cornerColor: 'red',
                stroke: 'pink',
                opacity : 0.8,
            },
            active : {
                fill: 'transparent',
                cornerColor: 'green',
                stroke: 'green',
                opacity : 0.8,
            },
            neutral : {
                fill: 'transparent',
                cornerColor: 'red',
                stroke: 'red',
                opacity : 1,
            },
        },
        selectable: true,
        hasBorders: false,
        transparentCorners: false,
        draggable: true,
        lockRotation: true,
        hasControls: true,
    };

    markerList : any[] = [];

    async sleep(time = 500) { return new Promise((r) => setTimeout(r, time));}

    async testCanvas() {
        await this.sleep(1000);
        this.player.setHome({ point : { x : 0.2, y:0.2 }, width : 0.45, height: 0.45, unit : 'percent' }, true);
        await this.sleep(1000);
        const MarkerRect1 = new MarkerRect(uid(8), this.options, 0.2, 0.2, 0.4, 0.4 );
        this.player.addMarker(MarkerRect1);
        this.markerList.push(MarkerRect1);

        await this.sleep(2000);
        this.player.setHome({ point : { x : 200, y:200 }, width : 50, height: 500, unit : 'pixel' }, true);
        await this.sleep(1000);
        const MarkerRect2 = new MarkerRect(uid(8),  this.options, 200, 200, 40, 400, 'pixel');
        this.player.addMarker(MarkerRect2);
        this.markerList.push(MarkerRect2);

        await this.sleep(2000);
        this.player.setHome({ point : { x : 400, y: 500 }, width : 800, height: 800, unit : 'pixel' }, true);
        await this.sleep(1000);
        const MarkerPoly1 = new MarkerPoly(uid(8), this.options, [{ x :0, y : 0 }, { x : 200, y : 700 },
            { x :750, y : 410 }], 'pixel');
        this.player.addMarker(MarkerPoly1);
        this.markerList.push(MarkerPoly1);

        await this.sleep(2000);
        this.player.setHome({ point : { x : 0.6, y: 0.6 }, width : 0.4, height: 0.4, unit : 'percent' }, true);
        await this.sleep(1000);
        const MarkerRound1 = new MarkerRound(uid(8), this.options, 0.6, 0.6, 0.3);
        this.player.addMarker(MarkerRound1);
        this.markerList.push(MarkerRound1);

        await this.sleep(1000);
        this.player.unsetHome(true);
    }

    async newMarker(type : MarkersType) {
        this.player.setDrawMode({
            isDrawing: true,
            options: this.options,
            unit: 'percent',
            type,
            data: { id: uid(8) },
        });
    }

    async ngOnInit() {
        this.player = new AnnotationOSDService(true);
        await this.player.playerFactory(
            'image',
            'player',
            'https://www.auto-moto.com/wp-content/uploads/sites/9/2022/02/01-peugeot-208-750x410.jpg',
        );
        this.player.addCanvas();

        this.player.objectActions.subscribe((e) => {
            console.log('subscriber :: ', e);
            if (e.type === 'createMarker') {
                this.markerList.push(e.object);
            }
            if (e.type === 'deleteMarker') {
                let index = this.markerList.findIndex(i => i.id === e.object?.id);
                if (index !== -1) {
                    this.markerList.splice(index, 1);
                }
            }
            if (e.type === 'object:modified' || e.type === 'object:scaling') {
                let index = this.markerList.findIndex(i => i.id === e.object?.id);
                this.markerList[index] = e.object;
            }
            if (e.type === 'clearCanvas') {
                this.markerList = [];
            }
        });

    }
}


