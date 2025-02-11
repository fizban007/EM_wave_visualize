import * as THREE from '../node_modules/three/build/three.module.js';
// import Stats from '../vendor/stats.module.js';
import { GUI } from '../node_modules/dat.gui/build/dat.gui.module.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from '../node_modules/three/examples/jsm/lines/Line2.js';
// import * as MeshLine from '../vender/THREE.MeshLine.js';
import { LineMaterial } from '../node_modules/three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from '../node_modules/three/examples/jsm/lines/LineGeometry.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
// import { RungeKutta4 } from '../node_modules/runge-kutta-4/dist/runge-kutta-4.min.js';
var RungeKutta4 = require('runge-kutta-4')

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;
const canvas = document.getElementById("vis");
var renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(width, height);

/// Setting up the scene
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// THREE.Object3D.DefaultUp.set(0.5,0.0,0.8);
var camera = new THREE.PerspectiveCamera(30, width / height, 1, 1000);
var camera_d = 10.0;
camera.position.x = camera_d;
camera.position.y = camera_d * 2;
camera.position.z = camera_d;
camera.up.set(0, 0, 1);
camera.lookAt(new THREE.Vector3(0, 10, 0));

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableKeys = false;

/// Config contains the physical and visualization parameters
var Config = function () {
  this.t = 0.0;
  this.delta = 0.25;
  this.n_vectors = 41;
  this.dt = 0.01;
  this.run = true;
  this.running = true;
  this.wave1 = false;
  this.wave2 = true;
  this.wave_sum = false;
  this.reset_camera = function() {
    controls.reset();
  }
}
var conf = new Config();

/// Add lighting to the star and other meshes
var directionalLight = new THREE.DirectionalLight(0xffffffff);
directionalLight.position.set(107, 107, 107);
scene.add(directionalLight);

var light = new THREE.AmbientLight(0xffffff); // soft white light
scene.add(light);

// const axesHelper = new THREE.AxesHelper( 10 );
// scene.add( axesHelper );

/// Add the xyz axes
var linex = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0)]),
                           new THREE.LineBasicMaterial({ color: 0x888888 }));
var liney = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 10, 0)]),
                           new THREE.LineBasicMaterial({ color: 0x888888 }));
var linez = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 2)]),
                            new THREE.LineBasicMaterial({ color: 0x888888 }));
var pivot1 = new THREE.Group();
pivot1.position.set(0, 0, 0);
scene.add(pivot1);

pivot1.add(linex);
pivot1.add(liney);
pivot1.add(linez);

var wave1 = new THREE.Group();
wave1.visible = conf.wave1;
scene.add(wave1);
var wave2 = new THREE.Group();
wave2.visible = conf.wave2;
scene.add(wave2);
var wave_sum = new THREE.Group();
scene.add(wave_sum);

var wave1E = [];
var wave1B = [];
var wave2E = [];
var wave2B = [];
var wave3E = [];
var wave3B = [];

/// Add the EM wave
var add_wave = function(wave, wave_vectors, angle, color) {
  for (var i = 0.5; i < conf.n_vectors; i++) {
    const dir = new THREE.Vector3( 0, 0, 1 );
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), i*2*Math.PI/conf.n_vectors + angle);
    //normalize the direction vector (convert to vector of length 1)
    dir.normalize();

    const origin = new THREE.Vector3( 0, i * conf.delta, 0 );
    const length = 2.0 * Math.abs(Math.sin(i * 2 * Math.PI / conf.n_vectors));
    const hex = color;

    const arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
    wave.add(arrowHelper);
    wave_vectors.push(arrowHelper);
  }
}

add_wave(wave1, wave1E, 0.0, 0xffff00);
add_wave(wave1, wave1B, Math.PI/2, 0x00ffff);
add_wave(wave2, wave2E, 0.0, 0xffff00);
add_wave(wave2, wave2B, Math.PI/2, 0x00ffff);
// pivot1.rotateOnWorldAxis(new THREE.Vector3(1.0, 0.0, 0.0), conf.phi1);
// pivot1.setRotationFromAxisAngle(new THREE.Vector3(1.0, 0.0, 0.0), conf.phi1);

const gui = new GUI();
gui.add(conf, 'dt').name('dt').min(0.01).max(0.1).step(0.001);
gui.add(conf, 'wave1').name('Wave 1').listen().onChange(function(value) {
  wave1.visible = value;
});
gui.add(conf, 'wave2').name('Wave 2').listen().onChange(function(value) {
  wave2.visible = value;
});
gui.add(conf, 'reset_camera').name('Reset Camera');

var start_stop = function() {
  conf.running = !conf.running;
}

gui.add(conf, 'run').name('Run').listen().onChange(start_stop);

var wave_advance = function(wave, waveE, waveB, dt, dphi, dir) {
  wave.rotation.y += dphi;
  for (var i = 0; i < waveE.length; i++) {
    waveE[i].position.y += dt * dir;
    waveB[i].position.y += dt * dir;
  }
  if (conf.t > conf.delta) {
    if (dir === 1) {
      var index = waveE.length - 1;
      waveE[index].position.y = 0;
      waveB[index].position.y = 0;
      waveE.unshift(waveE.splice(index, 1)[0]);
      waveB.unshift(waveB.splice(index, 1)[0]);
    } else if (dir === -1) {
      var index = 0;
      waveE[index].position.y = (waveE.length - 1) * conf.delta;
      waveB[index].position.y = (waveB.length - 1) * conf.delta;
      waveE.push(waveE.splice(index, 1)[0]);
      waveB.push(waveB.splice(index, 1)[0]);
    }
  }
}

function animate() {
  requestAnimationFrame(animate, canvas);

  if (conf.running) {
    conf.t += conf.dt;
    // wave 1 travels to the +y direction
    wave_advance(wave1, wave1E, wave1B, conf.dt, conf.dt, 1);
    wave_advance(wave2, wave2E, wave2B, conf.dt, conf.dt, -1);
    if (conf.t > conf.delta) {
      conf.t = 0.0;
    }
  }
  // set_rotation(conf.phi, conf.theta, conf.psi);

  renderer.render(scene, camera);
  // controls.update();
}

animate();
