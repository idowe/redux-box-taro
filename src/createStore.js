import composeEnhancers from "./composeEnhancers";
import createSagaMiddleware, { delay } from "redux-saga/dist/redux-saga";
import { effects } from "redux-saga/dist/redux-saga";
const { all, fork, call } = effects;
import getReducer from "./reducer";
import {
  applyMiddleware,
  combineReducers,
  createStore as storeCreator
} from "redux";

/*
Iterate through each module and keep stacking our reducers 
and sagas in their respective arrays. Finally 
we use these arrays to initialize the store using 
'createStore' from redux.
*/
export default function createStore(modules, config = {}) {
  //Initialize middleware array
  const sagaMiddleware = createSagaMiddleware();
  let middlewares = [sagaMiddleware];

  //push the provided middlewares in config object, to the middleware array
  if (config && config.middlewares && config.middlewares.length > 0) {
    middlewares = middlewares.concat(config.middlewares);
  }
  let reducerList = Object.assign({}, config.reducers);
  let sagas = [];

  //iterate through each module and push the sagas and reducers of each module in thier respective array
  modules.forEach(module => {
    sagas = sagas.concat(module.sagas);
    let moduleReducer = getReducer(module.mutations, module.state, module.name);
    if (module.decorateReducer)
      moduleReducer = module.decorateReducer(moduleReducer);
    reducerList[module.name] = moduleReducer;
  });
  config.sagas && config.sagas.forEach(saga => sagas.concat(saga));

  let combinedReducer = combineReducers(reducerList);
  if (config.decorateReducer) {
    combinedReducer = config.decorateReducer(combinedReducer);
  }
  let preloadedState = config.preloadedState || {};
  let composeRedux = composeEnhancers(config);
  //initialize the store using preloaded state, reducers and middlewares
  let store = storeCreator(
    combinedReducer,
    preloadedState,
    composeRedux(applyMiddleware(...middlewares))
  );

  // Default configuration for sagas
  const sagaConfig = Object.assign(
    {},
    {
      retryDelay: 2000,
      onError: err => {}
    },
    config.sagaConfig
  );

  function* rootSaga() {
    while (true) {
      try {
        yield all(sagas);
      } catch (err) {
        sagaConfig.onError(err);
        yield call(delay, sagaConfig.retryDelay);
      }
    }
  }
  sagaMiddleware.run(rootSaga);
  return store;
}
