const Utils = {

  /**
   * Returns the letter corresponding to the given index in the alphabet.
   * The index is 1-based, so the first letter is 'A' (index 1).
   * If the index is 0 or negative, an empty string is returned.
   * If the index is greater than 26, the function returns the letter at the
   * remainder of the division of the index by 26, prepended by the letter
   * at the index of the quotient of the division of the index by 26 (minus 1).
   * For example, numToLetter(28) returns 'AA', numToLetter(27) returns 'Z',
   * numToLetter(1) returns 'A', numToLetter(0) returns an empty string, and
   * numToLetter(-1) returns an empty string.
   * @param {number} index - the 1-based index of the letter to return
   * @return {string} the letter at the given index
   */
  numToLetter(index) {
    const az = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index < 1) return '';
    if (index < 27) return az[index - 1];
    const pre = Math.floor(index / 26);
    return Utils.numToLetter(index % 26 ? pre : pre - 1) + az[(index - 1) % 26];
  },


  /**
   * Create a proxy object for the Developer Metadata of the store.
   * It allows to read and write data to the metadata with automatic
   * saving when a property is changed.
   * @param {Store} store - The store where the metadata is located.
   * @returns {Proxy} - A proxy object for the metadata.
   */
  createMetadataProxy(store) {
    let metadata = store.getDeveloperMetadata();
    if (!metadata[0]) {
      store.addDeveloperMetadata('{}');
      metadata = store.getDeveloperMetadata();
    }
    const meta = metadata[0];
    let origin = JSON.parse(meta.getKey());
    let isDirty = false;

    return new Proxy(origin, {
      get(target, prop) {
        if (prop === 'save') return () => {
          if (isDirty) {
            meta.setKey(JSON.stringify(origin));
            isDirty = false;
          }
        };
        if (prop === 'toJSON') return () => origin;
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        isDirty = true;
        return true;
      }
    });
  },
  
  /**
   * Group consecutive numbers for optimization of deletion.
   * Example: [10, 9, 8, 5] -> [[10, 9, 8], [5]]
   * @param {number[]} arr - array of numbers
   * @returns {number[][]} - array of groups of consecutive numbers
   */
  groupConsecutive(arr) {
    if (!arr.length) return [];
    arr.sort((a, b) => b - a); 
    const groups = [[arr[0]]];
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i-1];
      const curr = arr[i];
      if (prev - curr === 1) {
        groups[groups.length - 1].push(curr);
      } else {
        groups.push([curr]);
      }
    }
    return groups;
  }
};
