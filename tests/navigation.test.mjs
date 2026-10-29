import test from 'node:test';import assert from 'node:assert/strict';import {navigationZoom,smoothHeading,formatSpeed,tripDistanceMeters} from '../src/navigation-utils.mjs';
test('zoom decreases at highway speeds',()=>assert.ok(navigationZoom(30)<navigationZoom(3)));
test('heading wraps across 360 degrees',()=>assert.ok(Math.abs(((smoothHeading(355,5,10)-5+540)%360)-180)<10));
test('speed converts meters per second',()=>assert.equal(formatSpeed(10),'36'));
test('distance between points',()=>assert.ok(tripDistanceMeters([[0,0],[.001,0]])>100));
