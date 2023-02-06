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
        perPixelTargetFind : true,
        hasControls: true,
    };

    markerList : any[] = [];


    async sleep(time = 500) { return new Promise((r) => setTimeout(r, time));}

    async testCanvas() {
        let testSet = [
            new MarkerRect(uid(8), this.options, 0.5052390015644317, 0.08231004774664871, 0.011343781115036256, 0.013756491247526127),
            new MarkerRound(uid(8), this.options, 0.47871194894140173, 0.39232053618287266, 0.02234813472672516),
            new MarkerPoly(uid(8), this.options, [
                {
                    'x': 0.4316416962890998,
                    'y': 0.5489801364390546,
                },
                {
                    'x': 0.4386621996589047,
                    'y': 0.5447779775592954,
                },
                {
                    'x': 0.44020178373123026,
                    'y': 0.5606621381247856,
                },
            ]),
            new MarkerRound(uid(8), this.options, 0.42457606876220605, 0.23531438469184932, 0.008287245150437548),
            new MarkerRect(uid(8), this.options, 0.4732954280435162, 0.2874712938103543, 0.005754267004021321, 0.01339302472052382),
        ];
        for await (const obj of testSet) {
            this.player.addMarker(obj);
            this.markerList.push(obj);
            this.player.setHomePointMarker(obj.id, true);
            await this.sleep(3000);
        }
        await this.sleep(2000);
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
        this.player = new AnnotationOSDService(false, true);
        await this.player.playerFactory({
            id : 'player',

        });
        this.player.addCanvas();

        this.markerList.forEach(e => this.player.addMarker(e));

        this.player.objectActions.subscribe((e) => {
            console.log('subscriber :: ', e);
            if (e.type === 'createMarker') {
                this.markerList.push(e.object);
                let id = (e.object as any).id;
                this.player.setHomePointMarker(id, true);
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


