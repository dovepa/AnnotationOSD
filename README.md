# AnnotationOSD


![image info](https://github.com/dovepa/AnnotationOSD/blob/master/projects/annotation-osd-showcase/src/assets/screenshot.png?raw=true)

## FabricJS + Open Sea Dragon Annotation Library for Angular

**AnnotationOSD** is an open source library ([code here](https://github.com/dovepa/AnnotationOSD))
designed for Angular that enables the annotation of DeepZoom type images by leveraging
other libraries such as fabricjs and openseadragon.\
**It also works with jpeg images**.\
With a user-friendly interface for adding, editing, and deleting annotations.\
This library is ideal for various image annotation applications,
including machine learning and image analysis projects.

Its simple and intuitive design offers quick and efficient image annotation,
saving time and effort for developers and users.

[A demo of AnnotationOSD is available Here](https://dovepa.github.io/AnnotationOSD/),
showcasing its powerful tools and user-friendly interface.\
Whether working on an image analysis project or just in need of a simple annotation tool,
**AnnotationOSD is a must-have for Angular developers.**

[See Npm Package](https://www.npmjs.com/package/ng-annotation-osd)


### Special thanks to [Tchek.ai](https://tchek.ai) for making this research project open source

![image info](https://github.com/dovepa/AnnotationOSD/blob/master/projects/annotation-osd-showcase/src/assets/Logo-black.svg?raw=true)

#### If you use this library, let me know on [linkedin](https://fr.linkedin.com/in/dovepalombo)  😉

### How To Install it :
For use it, add scripts inside angular.json
>"scripts": [\
"node_modules/ng-annotation-osd/assets/openseadragon.min.js",\
"node_modules/ng-annotation-osd/assets/fabric.adapted.js",\
"node_modules/ng-annotation-osd/assets/openseadragon-fabricjs-overlay.js"\
]

And  add providers inside app.module.ts
>  providers: [\
AnnotationOSDService\
]

### How To use it :

The demo project's page code is available [here](https://github.com/dovepa/AnnotationOSD/blob/master/projects/annotation-osd-showcase/src/app/app.component.ts).

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.2.0.
