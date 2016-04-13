
Here are a couple of objects that I use for storing sample data that comes in the form of a 2D matrix (samples-by-events).

eventData
---

The sample data are stored in this object. It also has some methods that are helpful for querying the stored data.

medbookDataLoader
---

This object contains various methods that are useful for loading data into an `eventData` object. Some of the methods are outdata, but have been kept because MedBook's data collections are constantly changing. I should probably do a clean-up at some point to get rid of the old stuff.


requirements
---

Requires `utils.js` from `staticJS` repo.
