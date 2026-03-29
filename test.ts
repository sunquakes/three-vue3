import * as THREE from 'three';

export default class TrafficLine {

  constructor(points, y, width) {
    this.create(points, y, width);
  }

  create (points, initY, initWidth) {
    const width = initWidth || 2;
    const y = initY || 0;
    let distance = 0;

    let lastPoint;
    points = points
      .filter((point, index) => {
        if (index == 0) {
          lastPoint = point;
          return true;
        } else {
          if (point[0] == lastPoint[0] && point[1] == lastPoint[1]) {
            return false;
          } else {
            lastPoint = point;
            return true;
          }
        }
      })
      .map((point) => {
        return {
          point: point,
          topPoint: null, // 路面上边沿点
          bottomPoint: null, // 下边沿
          distance: 0,
          direction: null, // 转向
        };
      });

    const arr = [];
    points.forEach((point, index) => {
      const currPoint = point;
      if (index == 0) {
        const nextPoint = points[index + 1]; // 下一个坐标点
        const vector = new THREE.Vector2(nextPoint.point[0] - currPoint.point[0], nextPoint.point[1] - currPoint.point[1]);
        vector.rotateAround(new THREE.Vector2(0, 0), -Math.PI / 2); // 旋转90度
        vector.normalize().multiplyScalar(width / 2); // 归一化
        currPoint.topPoint = [currPoint.point[0] + vector.x, currPoint.point[1] + vector.y];
        currPoint.bottomPoint = [point.point[0] - vector.x, point.point[1] - vector.y];
        currPoint.distance = 0;
        arr.push(currPoint);
      } else if (index < points.length - 1) {
        const lastPoint = points[index - 1]; // 上一个坐标点
        const currVector = new THREE.Vector2(currPoint.point[0] - lastPoint.point[0], currPoint.point[1] - lastPoint.point[1]); // 向量
        const nextPoint = points[index + 1]; // 下一个坐标点
        const nextVector = new THREE.Vector2(nextPoint.point[0] - currPoint.point[0], nextPoint.point[1] - currPoint.point[1]);
        let dAngle = nextVector.angle() - currVector.angle(); // 转向角度
        dAngle > Math.PI ? (dAngle -= 2 * Math.PI) : dAngle < -Math.PI ? (dAngle += 2 * Math.PI) : (dAngle = dAngle);
        if (Math.abs(dAngle) == Math.PI) {
          throw new Error(`PathLight路径存在180度转向，不允许。转向点：[${currPoint.point[0]},${currPoint.point[1]}]`);
        } else if (dAngle == 0) {
          // 直行
          const vector = currVector.clone().rotateAround(new THREE.Vector2(0, 0), -Math.PI / 2); // 旋转90度
          vector.normalize().multiplyScalar(width / 2); // 归一化
          currPoint.topPoint = [currPoint.point[0] + vector.x, currPoint.point[1] + vector.y];
          currPoint.bottomPoint = [point.point[0] - vector.x, point.point[1] - vector.y];
          currPoint.distance = lastPoint.distance + new THREE.Vector2(currPoint.point[0] - lastPoint.point[0], currPoint.point[1] - lastPoint.point[1]).length();
          arr.push(currPoint);
        } else {
          nextVector.negate(); // 取反
          let angle;
          angle = Math.acos((nextVector.x * currVector.x + nextVector.y * currVector.y) / (nextVector.length() * currVector.length()));
          const length = (0.5 * width) / Math.sin(angle);
          // 修正currVector和nextVector长度
          currVector.setLength(length);
          nextVector.setLength(length);
          const vector = currVector.clone().add(nextVector);
          if (dAngle > 0) {
            // 下边沿点
            const point = [currPoint.point[0] - vector.x, currPoint.point[1] - vector.y];

            // 补充路径点
            const vector1 = currVector.clone().rotateAround(new THREE.Vector2(0, 0), -Math.PI / 2);
            vector1.normalize().multiplyScalar(width / 2); // 归一化
            arr.push({
              point: [point[0] + vector1.x, point[1] + vector1.y],
              topPoint: [point[0] + vector1.x * 2, point[1] + vector1.y * 2],
              bottomPoint: point,
              distance: lastPoint.distance + new THREE.Vector2(point[0] + vector1.x - lastPoint.point[0], point[1] + vector1.y - lastPoint.point[1]).length(),
              direction: null,
            });

            arr.push(currPoint);
            currPoint.topPoint = [currPoint.point[0] + vector.x, currPoint.point[1] + vector.y]; // 上边沿点
            currPoint.bottomPoint = [currPoint.point[0] - vector.x, currPoint.point[1] - vector.y]; // 下边沿
            currPoint.distance = lastPoint.distance + new THREE.Vector2(currPoint.point[0] - lastPoint.point[0], currPoint.point[1] - lastPoint.point[1]).length();
            currPoint.direction = "right"; // 右转向

            // 补充路径点
            const vector2 = nextVector.clone().rotateAround(new THREE.Vector2(0, 0), Math.PI / 2);
            vector2.normalize().multiplyScalar(width / 2);
            arr.push({
              point: [point[0] + vector2.x, point[1] + vector2.y],
              topPoint: [point[0] + vector2.x * 2, point[1] + vector2.y * 2],
              bottomPoint: point,
              distance: currPoint.distance + new THREE.Vector2(point[0] + vector2.x - currPoint.point[0], point[1] + vector2.y - currPoint.point[1]).length(),
              direction: null,
            });
          } else {
            // 上边沿点
            const point = [currPoint.point[0] - vector.x, currPoint.point[1] - vector.y];

            // 补充路径点
            const vector1 = currVector.clone().rotateAround(new THREE.Vector2(0, 0), Math.PI / 2);
            vector1.normalize().multiplyScalar(width / 2);
            arr.push({
              point: [point[0] + vector1.x, point[1] + vector1.y],
              topPoint: point,
              bottomPoint: [point[0] + vector1.x * 2, point[1] + vector1.y * 2],
              distance: lastPoint.distance + new THREE.Vector2(point[0] + vector1.x - lastPoint.point[0], point[1] + vector1.y - lastPoint.point[1]).length(),
              direction: null,
            });

            arr.push(currPoint);
            currPoint.topPoint = [currPoint.point[0] - vector.x, currPoint.point[1] - vector.y];
            currPoint.bottomPoint = [currPoint.point[0] + vector.x, currPoint.point[1] + vector.y];
            currPoint.distance = lastPoint.distance + new THREE.Vector2(currPoint.point[0] - lastPoint.point[0], currPoint.point[1] - lastPoint.point[1]).length();
            currPoint.direction = "left"; // 标记为左转向

            // 补充路径点
            const vector2 = nextVector.clone().rotateAround(new THREE.Vector2(0, 0), -Math.PI / 2);
            vector2.normalize().multiplyScalar(width / 2); // 归一化
            arr.push({
              point: [point[0] + vector2.x, point[1] + vector2.y],
              topPoint: point,
              bottomPoint: [point[0] + vector2.x * 2, point[1] + vector2.y * 2],
              distance: currPoint.distance + new THREE.Vector2(point[0] + vector2.x - currPoint.point[0], point[1] + vector2.y - currPoint.point[1]).length(),
              direction: null,
            });
          }
        }
      } else {
        const lastPoint = points[index - 1]; // 上一个坐标点
        const vector = new THREE.Vector2(currPoint.point[0] - lastPoint.point[0], currPoint.point[1] - lastPoint.point[1]);
        vector.rotateAround(new THREE.Vector2(0, 0), -Math.PI / 2); // 旋转90度
        vector.normalize().multiplyScalar(width / 2); //归一化
        currPoint.topPoint = [currPoint.point[0] + vector.x, currPoint.point[1] + vector.y];
        currPoint.bottomPoint = [point.point[0] - vector.x, point.point[1] - vector.y];
        currPoint.distance = lastPoint.distance + new THREE.Vector2(currPoint.point[0] - lastPoint.point[0], currPoint.point[1] - lastPoint.point[1]).length();
        distance = currPoint.distance; // 路径总长度
        arr.push(currPoint);
      }
    });
    points = arr;
    console.log('points', points);

    const geometry = new THREE.BufferGeometry(); // 几何体
    const posArr = []; // 顶点数组
    const uvArr = []; // uv数组

    points.forEach((point, index) => {
      if (index == points.length - 1) return;
      const currPoint = point;
      const nextPoint = points[index + 1];

      if (!currPoint.direction && !nextPoint.direction) {
        // 三角面1
        posArr.push(currPoint.bottomPoint[0], y, currPoint.bottomPoint[1]);
        uvArr.push(currPoint.distance / distance, 0);
        posArr.push(nextPoint.bottomPoint[0], y, nextPoint.bottomPoint[1]);
        uvArr.push(nextPoint.distance / distance, 0);
        posArr.push(currPoint.topPoint[0], y, currPoint.topPoint[1]);
        uvArr.push(currPoint.distance / distance, 1);

        // 三角面2
        posArr.push(nextPoint.bottomPoint[0], y, nextPoint.bottomPoint[1]);
        uvArr.push(nextPoint.distance / distance, 0);
        posArr.push(nextPoint.topPoint[0], y, nextPoint.topPoint[1]);
        uvArr.push(nextPoint.distance / distance, 1);
        posArr.push(currPoint.topPoint[0], y, currPoint.topPoint[1]);
        uvArr.push(currPoint.distance / distance, 1);
      } else if (!currPoint.direction && nextPoint.direction) {
        // 三角面
        if (nextPoint.direction == "right") {
          posArr.push(nextPoint.bottomPoint[0], y, nextPoint.bottomPoint[1]);
          uvArr.push(currPoint.distance / distance, 0);
          posArr.push(nextPoint.topPoint[0], y, nextPoint.topPoint[1]);
          uvArr.push(nextPoint.distance / distance, 1);
          posArr.push(currPoint.topPoint[0], y, currPoint.topPoint[1]);
          uvArr.push(currPoint.distance / distance, 1);
        } else if (nextPoint.direction == "left") {
          posArr.push(nextPoint.bottomPoint[0], y, nextPoint.bottomPoint[1]);
          uvArr.push(nextPoint.distance / distance, 0);
          posArr.push(nextPoint.topPoint[0], y, nextPoint.topPoint[1]);
          uvArr.push(currPoint.distance / distance, 1);
          posArr.push(currPoint.bottomPoint[0], y, currPoint.bottomPoint[1]);
          uvArr.push(currPoint.distance / distance, 0);
        }
      } else if (currPoint.direction && !nextPoint.direction) {
        // 三角面
        if (currPoint.direction == "right") {
          posArr.push(currPoint.topPoint[0], y, currPoint.topPoint[1]);
          uvArr.push(currPoint.distance / distance, 1);
          posArr.push(currPoint.bottomPoint[0], y, currPoint.bottomPoint[1]);
          uvArr.push(nextPoint.distance / distance, 0);
          posArr.push(nextPoint.topPoint[0], y, nextPoint.topPoint[1]);
          uvArr.push(nextPoint.distance / distance, 1);
        } else if (currPoint.direction == "left") {
          posArr.push(currPoint.topPoint[0], y, currPoint.topPoint[1]);
          uvArr.push(nextPoint.distance / distance, 1);
          posArr.push(currPoint.bottomPoint[0], y, currPoint.bottomPoint[1]);
          uvArr.push(currPoint.distance / distance, 0);
          posArr.push(nextPoint.bottomPoint[0], y, nextPoint.bottomPoint[1]);
          uvArr.push(nextPoint.distance / distance, 0);
        }
      }
    });

    // 设置几何体
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(posArr), 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvArr), 2));

    const color2 = "#ff0000"; // 颜色
    const opacity2 = 1; // 透明度
    const textureUrl2 = require('@/assets/img/line.png'); // 纹理

    // 纹理
    const texture = new THREE.TextureLoader().load(textureUrl2);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // 材质
    const material = new THREE.MeshBasicMaterial({
      color: color2, // 颜色
      map: texture, // 纹理贴图
      transparent: true,
      opacity: opacity2, // 透明度
      depthWrite: false,
      side: THREE.DoubleSide,
      //wireframe: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    texture.repeat.set(20, 1); // 纹理缩放
    // 偏移开始时间
    const start = Date.now();
    // 启动纹理偏移
    const h = () => {
      requestAnimationFrame(h);
      const now = Date.now(); // 当前时间
      const offset = ((now - start) / 1000) * 1.5; // 当前偏移量
      texture.offset = new THREE.Vector2(-offset, 0); //偏移
    };
    requestAnimationFrame(h);
    this.scene = mesh;
  }
}