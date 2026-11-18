<template>
  <div class="traffic-light">
    <div class="light red" :class="{ active: currentLight === 'red' }"></div>
    <div class="light yellow" :class="{ active: currentLight === 'yellow' }"></div>
    <div class="light green" :class="{ active: currentLight === 'green' }"></div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

export default {
  name: 'TrafficLight',
  setup() {
    const currentLight = ref('red')
    let timer

    const changeLight = () => {
      if (currentLight.value === 'red') {
        currentLight.value = 'green'
      } else if (currentLight.value === 'green') {
        currentLight.value = 'yellow'
      } else if (currentLight.value === 'yellow') {
        currentLight.value = 'red'
      }
    }

    onMounted(() => {
      timer = setInterval(changeLight, 2000)
    })

    onUnmounted(() => {
      clearInterval(timer)
    })

    return {
      currentLight
    }
  }
}
</script>

<style scoped>
.traffic-light {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #333;
  border-radius: 6px;
  border: 1px solid #666;
}

.light {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transition: all 0.3s;
}

.red {
  background: #330000;
}

.red.active {
  background: #ff0000;
  box-shadow: 0 0 10px #ff0000;
}

.yellow {
  background: #333300;
}

.yellow.active {
  background: #ffff00;
  box-shadow: 0 0 10px #ffff00;
}

.green {
  background: #003300;
}

.green.active {
  background: #00ff00;
  box-shadow: 0 0 10px #00ff00;
}
</style>
