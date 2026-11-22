package ar.gestorpenal.person;

import java.util.List;
import org.springframework.data.domain.Page;

/** One page of search results; {@code page} starts at 0. */
record PersonPage(List<PersonView> items, int page, int size, long total) {

    static PersonPage of(Page<Person> people) {
        return new PersonPage(
                people.getContent().stream().map(PersonView::of).toList(),
                people.getNumber(),
                people.getSize(),
                people.getTotalElements());
    }
}
