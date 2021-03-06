/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {Message} from '../../nuclide-console/lib/types';
import type {
  AppState,
  CommitModeType,
  DiffModeType,
} from './types';
import type {
  RevisionInfo,
} from '../../nuclide-hg-rpc/lib/HgService';
import type {NuclideUri} from '../../commons-node/nuclideUri';
import typeof * as BoundActionCreators from './redux/Actions';

export type DiffEntityOptions = {
  file?: NuclideUri,
  directory?: NuclideUri,
  viewMode?: DiffModeType,
  commitMode?: CommitModeType,
  // Only open the split diff view, not the source control navigator.
  onlyDiff?: boolean,
};

import {Emitter} from 'atom';
import invariant from 'assert';
import {track} from '../../nuclide-analytics';
import {Subject} from 'rxjs';
import {createEmptyAppState} from './redux/createEmptyAppState';

const DID_UPDATE_STATE_EVENT = 'did-update-state';

export default class DiffViewModel {
  _emitter: Emitter;
  _state: AppState;
  _progressUpdates: Subject<Message>;
  _actionCreators: BoundActionCreators;

  constructor(actionCreators: BoundActionCreators, progressUpdates: Subject<Message>) {
    this._actionCreators = actionCreators;
    this._progressUpdates = progressUpdates;
    this._emitter = new Emitter();
    this._state = createEmptyAppState();
  }

  diffFile(filePath: NuclideUri): void {
    this._actionCreators.diffFile(filePath);
  }

  getDirtyFileChangesCount(): number {
    const {activeRepositoryState: {dirtyFiles}} = this._state;
    return dirtyFiles.size;
  }

  setViewMode(viewMode: DiffModeType): void {
    this._actionCreators.setViewMode(viewMode);
  }

  setCompareRevision(revision: RevisionInfo): void {
    track('diff-view-set-revision');
    invariant(this._state.activeRepository != null, 'There must be an active repository!');
    this._actionCreators.setCompareId(this._state.activeRepository, revision.id);
  }

  publishDiff(
    publishMessage: string,
    isPrepareMode: boolean,
    lintExcuse: ?string,
  ): void {
    const activeRepository = this._state.activeRepository;
    invariant(activeRepository != null, 'Cannot publish without an active stack!');

    this._actionCreators.publishDiff(
      activeRepository,
      publishMessage,
      isPrepareMode,
      lintExcuse,
      this._progressUpdates,
    );
  }

  updatePublishMessage(message: ?string): void {
    const {publish} = this._state;
    this._actionCreators.updatePublishState({
      ...publish,
      message,
    });
  }

  onDidUpdateState(callback: () => mixed): IDisposable {
    return this._emitter.on(DID_UPDATE_STATE_EVENT, callback);
  }

  commit(message: string, bookmarkName: ?string): void {
    if (message === '') {
      atom.notifications.addError('Commit aborted', {detail: 'Commit message empty'});
      return;
    }
    const activeRepository = this._state.activeRepository;
    invariant(activeRepository != null, 'No active repository stack');
    this._actionCreators.commit(
      activeRepository,
      message,
      this._progressUpdates,
      bookmarkName,
    );
  }

  injectState(newState: AppState): void {
    this._state = newState;
    this._emitter.emit(DID_UPDATE_STATE_EVENT);
  }

  getState(): AppState {
    return this._state;
  }

  setCommitMode(commitMode: CommitModeType): void {
    this._actionCreators.setCommitMode(commitMode);
  }

  setShouldAmendRebase(shouldRebaseOnAmend: boolean): void {
    this._actionCreators.setShouldRebaseOnAmend(shouldRebaseOnAmend);
  }

  setShouldPublishOnCommit(shoulPublishOnCommit: boolean): void {
    this._actionCreators.setShouldPublishOnCommit(shoulPublishOnCommit);
  }

  updatePublishStateWithMessage(message: ?string): void {
    this._actionCreators.updatePublishState({
      ...this._state.publish,
      message,
    });
  }

  setIsPrepareMode(isPrepareMode: boolean): void {
    this._actionCreators.setIsPrepareMode(isPrepareMode);
  }

  setVerbatimModeEnabled(verbatimModeEnabled: boolean): void {
    this._actionCreators.setVerbatimModeEnabled(verbatimModeEnabled);
  }
}
