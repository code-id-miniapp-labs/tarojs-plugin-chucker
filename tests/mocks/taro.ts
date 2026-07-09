class EventCenter {
  private events: Record<string, Function[]> = {};

  on(name: string, callback: Function) {
    if (!this.events[name]) this.events[name] = [];
    this.events[name].push(callback);
  }

  off(name: string, callback?: Function) {
    if (!callback) {
      delete this.events[name];
    } else if (this.events[name]) {
      this.events[name] = this.events[name].filter((cb) => cb !== callback);
    }
  }

  trigger(name: string, ...args: any[]) {
    if (this.events[name]) {
      this.events[name].forEach((cb) => {
        try {
          cb(...args);
        } catch (e) {
          console.error(`Callback error for event ${name}:`, e);
        }
      });
    }
  }
}

const eventCenter = new EventCenter();

const mockRequestTask = {
  abort: jest.fn(),
  onHeadersReceived: jest.fn(),
  offHeadersReceived: jest.fn(),
  onChunkReceived: jest.fn(),
  offChunkReceived: jest.fn(),
  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve({
      statusCode: 200,
      data: { success: true },
      header: {},
    }).then(onfulfilled, onrejected);
  },
};

const mockUploadTask = {
  abort: jest.fn(),
  onProgressUpdate: jest.fn(),
  offProgressUpdate: jest.fn(),
  onHeadersReceived: jest.fn(),
  offHeadersReceived: jest.fn(),
  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve({
      statusCode: 200,
      data: '{"success":true}',
      header: {},
    }).then(onfulfilled, onrejected);
  },
};

const mockDownloadTask = {
  abort: jest.fn(),
  onProgressUpdate: jest.fn(),
  offProgressUpdate: jest.fn(),
  onHeadersReceived: jest.fn(),
  offHeadersReceived: jest.fn(),
  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve({
      statusCode: 200,
      tempFilePath: "temp/file/path",
      header: {},
    }).then(onfulfilled, onrejected);
  },
};

const Taro: any = {
  eventCenter,
  request: jest.fn().mockImplementation(() => {
    return mockRequestTask;
  }),
  uploadFile: jest.fn().mockImplementation(() => {
    return mockUploadTask;
  }),
  downloadFile: jest.fn().mockImplementation(() => {
    return mockDownloadTask;
  }),
};

export default Taro;
